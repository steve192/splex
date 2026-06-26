from django.db import transaction
from django.utils import timezone

from splex.activity.events import EventType
from splex.activity.services import record_activity
from splex.expenses.models import Expense, ExpenseOwedShare, ExpensePaymentShare
from splex.friends.models import Friendship
from splex.friends.services import active_friendship_for, get_or_create_friendship
from splex.groups.models import Group, GroupMembership
from splex.invitations.models import Invitation
from splex.notifications.services import create_notifications_for_activity
from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant
from splex.settlements.models import Settlement
from splex.shared.errors import DomainError, DomainPermissionError, ErrorCode
from splex.shared.uploads import delete_stored_image, save_data_url_image


@transaction.atomic
def create_group(*, actor, name: str, default_currency: str) -> Group:
    participant = get_or_create_user_participant(actor)
    group = Group.objects.create(
        name=name, default_currency=default_currency.upper(), created_by=actor
    )
    GroupMembership.objects.create(
        group=group, participant=participant, role=GroupMembership.Role.ADMIN
    )
    event = record_activity(actor, EventType.GROUP_CREATED, group=group, payload={})
    create_notifications_for_activity(event)
    return group


@transaction.atomic
def add_unregistered_participant(*, actor, group: Group, display_name: str) -> Participant:
    assert_group_member(actor, group)
    participant = Participant.objects.create(
        display_name=display_name, kind=Participant.Kind.UNREGISTERED
    )
    GroupMembership.objects.create(group=group, participant=participant)
    event = record_activity(
        actor,
        EventType.GROUP_MEMBER_ADDED,
        group=group,
        payload={"target_participant_id": participant.id},
    )
    create_notifications_for_activity(event)
    return participant


def _record_participant_added(actor, group: Group, participant: Participant) -> None:
    event = record_activity(
        actor,
        EventType.GROUP_MEMBER_ADDED,
        group=group,
        payload={"target_participant_id": participant.id},
    )
    create_notifications_for_activity(event)


def activate_group_membership(
    *, group: Group, participant: Participant
) -> tuple[GroupMembership, str]:
    """Get-or-create an active membership for the (group, participant) pair.

    Returns (membership, status) where status is one of:
      - "created"          - a brand-new membership row was inserted.
      - "reactivated"      - an existing soft-removed row had its `removed_at` cleared.
      - "already_active"   - the participant was already an active member; caller decides
                             whether that's an error or a no-op.

    The model's `unique_together` on (group, participant) makes this race-safe.
    """
    membership, created = GroupMembership.objects.get_or_create(
        group=group, participant=participant
    )
    if created:
        return membership, "created"
    if membership.removed_at is None:
        return membership, "already_active"
    membership.removed_at = None
    membership.save(update_fields=["removed_at"])
    return membership, "reactivated"


def add_registered_participant(*, actor, group: Group, participant: Participant) -> Participant:
    assert_group_member(actor, group)
    actor_participant = get_or_create_user_participant(actor)
    if participant.id == actor_participant.id:
        raise DomainError(ErrorCode.GROUP_ALREADY_MEMBER, "You are already a member.")
    if active_friendship_for(actor_participant, participant) is None:
        raise DomainError(
            ErrorCode.GROUP_EXISTING_FRIEND_REQUIRED,
            "Only existing friends can be added.",
        )

    _, status = activate_group_membership(group=group, participant=participant)
    if status == "already_active":
        raise DomainError(
            ErrorCode.GROUP_PARTICIPANT_ALREADY_MEMBER,
            "Participant is already a member.",
        )

    ensure_friendships_for_group(group)
    _record_participant_added(actor, group, participant)
    return participant


@transaction.atomic
def update_group(*, actor, group: Group, data: dict) -> Group:
    assert_group_member(actor, group)
    if group.deleted_at:
        raise DomainError(ErrorCode.GROUP_DELETED, "Deleted groups cannot be changed.")
    changed = []
    old_icon_path = None
    if "name" in data:
        group.name = data["name"]
        changed.append("name")
    if data.get("icon_image"):
        old_icon_path = group.icon_url
        group.icon_url = save_data_url_image(data_url=data["icon_image"], folder="group-icons")
        # An icon change always replaces any previous attribution; if the
        # caller supplied a new one, use it, otherwise reset to blank.
        group.icon_attribution = data.get("icon_attribution") or ""
        changed.append("icon_url")
        changed.append("icon_attribution")
    elif "icon_attribution" in data:
        group.icon_attribution = data["icon_attribution"] or ""
        changed.append("icon_attribution")
    if "default_currency" in data:
        has_ledger = (
            Expense.objects.filter(group=group).exists()
            or Settlement.objects.filter(group=group).exists()
        )
        if has_ledger and data["default_currency"].upper() != group.default_currency:
            raise DomainError(
                ErrorCode.GROUP_CURRENCY_LOCKED,
                "Group currency cannot be changed after ledger entries exist.",
            )
        group.default_currency = data["default_currency"].upper()
        changed.append("default_currency")
    if "default_split_method" in data:
        group.default_split_method = data["default_split_method"]
        changed.append("default_split_method")
    if "default_split_payload" in data:
        group.default_split_payload = data["default_split_payload"] or {}
        changed.append("default_split_payload")
    if "archived" in data:
        group.archived_at = timezone.now() if data["archived"] else None
        changed.append("archived_at")
    if changed:
        group.save(update_fields=[*changed, "updated_at"])
        # Replacing the icon orphans the previous blob; remove it once the new
        # path is saved.
        if old_icon_path and old_icon_path != group.icon_url:
            delete_stored_image(old_icon_path)
        event = record_activity(
            actor,
            EventType.GROUP_UPDATED,
            group=group,
            payload={"changed": changed},
        )
        create_notifications_for_activity(event)
    return group


@transaction.atomic
def delete_group(*, actor, group: Group, require_settled: bool = True) -> None:
    # Local import avoids a circular dependency (balances.selectors imports from
    # expenses/settlements which transitively reach back into groups).
    from splex.balances.selectors import group_has_outstanding_balance

    assert_group_member(actor, group)
    if group.deleted_at:
        return
    # Explicit deletion must be settled first (parity with friend removal), but
    # leaving as the last member abandons the group outright - the only balances
    # left are with unregistered placeholders, so we don't force a settle-up.
    if require_settled and group_has_outstanding_balance(group):
        raise DomainError(ErrorCode.GROUP_NOT_SETTLED, "Settle up before deleting this group.")
    now = timezone.now()
    group.deleted_at = now
    if not group.archived_at:
        group.archived_at = now
    group.save(update_fields=["deleted_at", "archived_at", "updated_at"])
    # Local import avoids circular dependency with expenses.receipts.
    from splex.expenses.receipts import delete_receipts_for_group

    delete_receipts_for_group(group)
    event = record_activity(actor, EventType.GROUP_DELETED, group=group, payload={})
    create_notifications_for_activity(event)


def _convert_participant_in_group(*, group: Group, participant: Participant) -> Participant:
    """Replace a registered participant's presence in a group with an unregistered placeholder.

    Creates a new UNREGISTERED Participant whose display_name is a snapshot of the
    current effective name, then re-points all group-scoped expense shares, settlements,
    invitations, and the group membership to the new placeholder.  The original
    participant's membership is *transferred* (not removed) so the placeholder remains
    an active member and balances keep working correctly without any auto-settlement.
    Returns the new placeholder participant.
    """
    display_name = participant.effective_display_name
    placeholder = Participant.objects.create(
        kind=Participant.Kind.UNREGISTERED,
        display_name=display_name,
    )

    expense_ids = list(
        Expense.objects.filter(group=group).values_list("id", flat=True)
    )
    if expense_ids:
        ExpensePaymentShare.objects.filter(
            expense_id__in=expense_ids, participant=participant
        ).update(participant=placeholder)
        ExpenseOwedShare.objects.filter(
            expense_id__in=expense_ids, participant=participant
        ).update(participant=placeholder)

    Settlement.objects.filter(group=group, payer_participant=participant).update(
        payer_participant=placeholder
    )
    Settlement.objects.filter(group=group, receiver_participant=participant).update(
        receiver_participant=placeholder
    )

    Invitation.objects.filter(group=group, target_participant=participant).update(
        target_participant=placeholder
    )

    # Transfer the membership to the placeholder so it stays an active group member.
    GroupMembership.objects.filter(
        group=group, participant=participant
    ).update(participant=placeholder)

    return placeholder


@transaction.atomic
def remove_group_participant(*, actor, group: Group, participant: Participant) -> None:
    """Remove a participant from a group.

    Behavior depends on the participant kind:
      - REGISTERED:   convert to an unregistered placeholder so the user keeps
                      access to their own data while history in this group is
                      preserved under a placeholder identity (existing behavior).
      - UNREGISTERED: auto-settle any outstanding balances with the other group
                      members, mark the membership as removed, and soft-delete
                      the Participant row. The row stays so historical expenses
                      still resolve `effective_display_name`, but they're no
                      longer an active group member.
    """
    assert_group_member(actor, group)
    if not GroupMembership.objects.filter(
        group=group, participant=participant, removed_at__isnull=True
    ).exists():
        raise DomainError(
            ErrorCode.GROUP_PARTICIPANT_INACTIVE,
            "Participant is not an active member.",
        )
    if participant.user_id == actor.id:
        raise DomainError(ErrorCode.GROUP_REMOVE_SELF, "You cannot remove yourself here.")

    if participant.kind == Participant.Kind.UNREGISTERED:
        target_id = _settle_and_soft_delete(group=group, participant=participant)
    else:
        target_id = _convert_participant_in_group(group=group, participant=participant).id

    event = record_activity(
        actor,
        EventType.GROUP_MEMBER_REMOVED,
        group=group,
        payload={"target_participant_id": target_id},
    )
    create_notifications_for_activity(event)


def _settle_and_soft_delete(*, group: Group, participant: Participant) -> int:
    """Zero out the participant's balances with settlement rows, then mark them
    removed from the group and soft-delete the Participant row.

    Returns the (now soft-deleted) participant's id for activity logging - the
    row still exists so expense serializers can resolve their name.
    """
    from splex.balances.selectors import group_debts

    for (debtor_id, creditor_id), amount in group_debts(group).items():
        if amount <= 0:
            continue
        if participant.id not in (debtor_id, creditor_id):
            continue
        Settlement.objects.create(
            group=group,
            payer_participant_id=debtor_id,
            receiver_participant_id=creditor_id,
            amount=amount,
            currency=group.default_currency,
            kind=Settlement.Kind.AUTO_WRITE_OFF,
        )

    now = timezone.now()
    GroupMembership.objects.filter(group=group, participant=participant).update(removed_at=now)
    participant.deleted_at = now
    participant.save(update_fields=["deleted_at", "updated_at"])
    return participant.id


@transaction.atomic
def leave_group(*, actor, group: Group) -> None:
    participant = get_group_participant(actor, group)
    active_memberships = GroupMembership.objects.select_for_update().filter(
        group=group,
        removed_at__isnull=True,
    )
    has_other_registered_members = active_memberships.exclude(participant=participant).filter(
        participant__user__isnull=False,
    ).exists()
    if not has_other_registered_members:
        delete_group(actor=actor, group=group, require_settled=False)
        return

    placeholder = _convert_participant_in_group(group=group, participant=participant)
    event = record_activity(
        actor,
        EventType.GROUP_MEMBER_REMOVED,
        group=group,
        payload={"target_participant_id": placeholder.id},
    )
    create_notifications_for_activity(event)


@transaction.atomic
def rename_unregistered_participant(
    *, actor, group: Group, participant: Participant, display_name: str
) -> Participant:
    assert_group_member(actor, group)
    if participant.kind != Participant.Kind.UNREGISTERED:
        raise DomainError(
            ErrorCode.GROUP_RENAME_REGISTERED,
            "Only unregistered participants can be renamed.",
        )
    if not GroupMembership.objects.filter(group=group, participant=participant).exists():
        raise DomainError(
            ErrorCode.GROUP_PARTICIPANT_NOT_MEMBER,
            "Participant is not in this group.",
        )
    old_name = participant.display_name
    participant.display_name = display_name
    participant.save(update_fields=["display_name", "updated_at"])
    event = record_activity(
        actor,
        EventType.GROUP_MEMBER_RENAMED,
        group=group,
        payload={
            "target_participant_id": participant.id,
            "oldName": old_name,
        },
    )
    create_notifications_for_activity(event)
    return participant


def get_group_participant(user, group: Group) -> Participant:
    """Return the user's active participant in the group; raise PermissionError otherwise."""
    participant = get_or_create_user_participant(user)
    if not GroupMembership.objects.filter(
        group=group, participant=participant, removed_at__isnull=True
    ).exists():
        raise DomainPermissionError(
            ErrorCode.GROUP_MEMBER_REQUIRED,
            "You are not a member of this group.",
        )
    return participant


def assert_group_member(user, group: Group) -> None:
    """Raise PermissionError if `user` is not an active member of `group`."""
    get_group_participant(user, group)


def ensure_friendships_for_group(group: Group):
    """Make sure every pair of registered group members is befriended.

    Pre-existing friendships (including EXPLICIT ones from friend invites) are
    reused; only missing pairs get a fresh SHARED_GROUP row.
    """
    registered = list(
        Participant.objects.filter(
            group_memberships__group=group,
            group_memberships__removed_at__isnull=True,
            user__isnull=False,
        )
    )
    for left_index, left in enumerate(registered):
        for right in registered[left_index + 1 :]:
            get_or_create_friendship(
                left,
                right,
                source=Friendship.Source.SHARED_GROUP,
                default_currency=group.default_currency,
            )

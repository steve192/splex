from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from splex.activity.events import EventType
from splex.activity.services import record_activity
from splex.balances.selectors import group_debts
from splex.expenses.models import Expense
from splex.friends.models import Friendship
from splex.groups.models import Group, GroupMembership
from splex.notifications.services import create_notifications_for_activity
from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant
from splex.settlements.models import Settlement
from splex.shared.money import money
from splex.shared.uploads import save_data_url_image


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


def add_registered_participant(*, actor, group: Group, participant: Participant) -> Participant:
    assert_group_member(actor, group)
    actor_participant = get_or_create_user_participant(actor)
    if participant.id == actor_participant.id:
        raise ValueError("You are already a member of this group.")
    if not Friendship.objects.filter(
        Q(participant_a=actor_participant, participant_b=participant)
        | Q(participant_a=participant, participant_b=actor_participant),
        ended_at__isnull=True,
    ).exists():
        raise ValueError("Only existing friends can be added as registered members.")

    membership, created = GroupMembership.objects.get_or_create(group=group, participant=participant)
    if not created and membership.removed_at is None:
        raise ValueError("Participant is already a member of this group.")

    if membership.removed_at is not None:
        membership.removed_at = None
        membership.save(update_fields=["removed_at"])

    ensure_friendships_for_group(group)
    _record_participant_added(actor, group, participant)
    return participant


@transaction.atomic
def update_group(*, actor, group: Group, data: dict) -> Group:
    assert_group_member(actor, group)
    if group.deleted_at:
        raise ValueError("Deleted groups cannot be changed.")
    changed = []
    if "name" in data:
        group.name = data["name"]
        changed.append("name")
    if data.get("icon_image"):
        group.icon_url = save_data_url_image(data_url=data["icon_image"], folder="group-icons")
        changed.append("icon_url")
    if "default_currency" in data:
        has_ledger = (
            Expense.objects.filter(group=group).exists()
            or Settlement.objects.filter(group=group).exists()
        )
        if has_ledger and data["default_currency"].upper() != group.default_currency:
            raise ValueError("Group currency cannot be changed after ledger entries exist.")
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
        event = record_activity(
            actor,
            EventType.GROUP_UPDATED,
            group=group,
            payload={"changed": changed},
        )
        create_notifications_for_activity(event)
    return group


@transaction.atomic
def delete_group(*, actor, group: Group) -> None:
    assert_group_member(actor, group)
    if group.deleted_at:
        return
    now = timezone.now()
    group.deleted_at = now
    if not group.archived_at:
        group.archived_at = now
    group.save(update_fields=["deleted_at", "archived_at", "updated_at"])
    event = record_activity(actor, EventType.GROUP_DELETED, group=group, payload={})
    create_notifications_for_activity(event)


def _auto_settle_participant(actor, group: Group, participant: Participant) -> int:
    """Create settlements that bring this participant's pair-wise balances to zero.

    Returns the number of settlements created. Skipped pairs (zero net) emit nothing.
    """
    created = 0
    for (debtor_id, creditor_id), amount in group_debts(group).items():
        if participant.id not in (debtor_id, creditor_id):
            continue
        net = money(amount)
        if net <= 0:
            continue
        Settlement.objects.create(
            group=group,
            payer_participant_id=debtor_id,
            receiver_participant_id=creditor_id,
            amount=net,
            currency=group.default_currency,
            created_by=actor,
        )
        created += 1
    return created


@transaction.atomic
def remove_group_participant(*, actor, group: Group, participant: Participant) -> None:
    assert_group_member(actor, group)
    membership = GroupMembership.objects.get(
        group=group, participant=participant, removed_at__isnull=True
    )
    if participant.user_id == actor.id:
        raise ValueError("You cannot remove yourself from the group here.")
    auto_settled = _auto_settle_participant(actor, group, participant)
    membership.removed_at = timezone.now()
    membership.save(update_fields=["removed_at"])
    event = record_activity(
        actor,
        EventType.GROUP_MEMBER_REMOVED,
        group=group,
        payload={"target_participant_id": participant.id, "autoSettled": auto_settled},
    )
    create_notifications_for_activity(event)


@transaction.atomic
def rename_unregistered_participant(
    *, actor, group: Group, participant: Participant, display_name: str
) -> Participant:
    assert_group_member(actor, group)
    if participant.kind != Participant.Kind.UNREGISTERED:
        raise ValueError("Only unregistered participants can be renamed.")
    if not GroupMembership.objects.filter(group=group, participant=participant).exists():
        raise ValueError("Participant is not in this group.")
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
        raise PermissionError("You are not a member of this group.")
    return participant


def assert_group_member(user, group: Group) -> None:
    """Raise PermissionError if `user` is not an active member of `group`."""
    get_group_participant(user, group)


def ensure_friendships_for_group(group: Group):
    registered = list(
        Participant.objects.filter(
            group_memberships__group=group,
            group_memberships__removed_at__isnull=True,
            user__isnull=False,
        )
    )
    for left_index, left in enumerate(registered):
        for right in registered[left_index + 1 :]:
            a, b = sorted([left, right], key=lambda participant: participant.id)
            Friendship.objects.get_or_create(
                participant_a=a,
                participant_b=b,
                source=Friendship.Source.SHARED_GROUP,
                defaults={"default_currency": group.default_currency},
            )

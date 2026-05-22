from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from splex.activity.events import EventType
from splex.activity.services import record_activity
from splex.expenses.models import ExpenseOwedShare, ExpensePaymentShare
from splex.friends.models import Friendship
from splex.friends.services import create_friendship
from splex.groups.models import GroupMembership
from splex.groups.services import (
    activate_group_membership,
    assert_group_member,
    ensure_friendships_for_group,
)
from splex.invitations.models import Invitation
from splex.notifications.services import create_notifications_for_activity
from splex.settlements.models import Settlement
from splex.participants.services import get_or_create_user_participant


def invitation_url(token: str) -> str:
    return f"{settings.FRONTEND_PUBLIC_URL}/invite/{token}"


@transaction.atomic
def create_group_invitation(*, actor, group):
    assert_group_member(actor, group)
    invitation, token = Invitation.create_with_token(
        type=Invitation.Type.GROUP_JOIN,
        group=group,
        invited_by=actor,
    )
    event = record_activity(actor, EventType.GROUP_MEMBER_INVITED, group=group, payload={})
    create_notifications_for_activity(event)
    return invitation, token, invitation_url(token)


@transaction.atomic
def create_claim_invitation(*, actor, group, target_participant):
    assert_group_member(actor, group)
    invitation, token = Invitation.create_with_token(
        type=Invitation.Type.CLAIM_PARTICIPANT,
        group=group,
        target_participant=target_participant,
        invited_by=actor,
    )
    event = record_activity(
        actor,
        EventType.GROUP_MEMBER_INVITED,
        group=group,
        payload={"target_participant_id": target_participant.id},
    )
    create_notifications_for_activity(event)
    return invitation, token, invitation_url(token)


@transaction.atomic
def create_friend_invitation(*, actor):
    invitation, token = Invitation.create_with_token(
        type=Invitation.Type.FRIEND_JOIN,
        invited_by=actor,
    )
    record_activity(actor, EventType.FRIEND_INVITED, payload={})
    return invitation, token, invitation_url(token)


def _remove_placeholder_participant(user):
    existing = getattr(user, "participant", None)
    if not existing:
        return
    has_relations = (
        existing.group_memberships.exists()
        or existing.friendships_a.exists()
        or existing.friendships_b.exists()
        or existing.settlements_paid.exists()
        or existing.settlements_received.exists()
    )
    if not has_relations:
        existing.delete()


def _membership_role(existing, membership):
    if (
        existing.role == GroupMembership.Role.ADMIN
        or membership.role == GroupMembership.Role.ADMIN
    ):
        return GroupMembership.Role.ADMIN
    return GroupMembership.Role.MEMBER


def _membership_removed_at(existing, membership):
    if existing.removed_at is None or membership.removed_at is None:
        return None
    return max(existing.removed_at, membership.removed_at)


def _update_membership(existing, membership):
    changed_fields = []
    role = _membership_role(existing, membership)
    if existing.role != role:
        existing.role = role
        changed_fields.append("role")

    joined_at = min(existing.joined_at, membership.joined_at)
    if existing.joined_at != joined_at:
        existing.joined_at = joined_at
        changed_fields.append("joined_at")

    removed_at = _membership_removed_at(existing, membership)
    if existing.removed_at != removed_at:
        existing.removed_at = removed_at
        changed_fields.append("removed_at")

    if changed_fields:
        existing.save(update_fields=changed_fields)


def _merge_group_memberships(*, source, destination):
    memberships = list(source.group_memberships.select_for_update().select_related("group"))
    for membership in memberships:
        existing = GroupMembership.objects.filter(
            group=membership.group,
            participant=destination,
        ).first()
        if not existing:
            membership.participant = destination
            membership.save(update_fields=["participant"])
            continue

        _update_membership(existing, membership)
        membership.delete()


def _merge_friendship_duplicate(duplicate, friendship):
    ended_at = None if (
        duplicate.ended_at is None or friendship.ended_at is None
    ) else max(duplicate.ended_at, friendship.ended_at)
    if duplicate.ended_at != ended_at:
        duplicate.ended_at = ended_at
        duplicate.save(update_fields=["ended_at"])


def _friendship_duplicate(*, friendship, destination_id, other_id):
    left_id, right_id = sorted([destination_id, other_id])
    duplicate = Friendship.objects.filter(
        participant_a_id=left_id,
        participant_b_id=right_id,
        source=friendship.source,
    ).exclude(id=friendship.id).first()
    return duplicate, left_id, right_id


def _merge_friendships(*, source, destination):
    friendships = list(
        Friendship.objects.select_for_update().filter(
            Q(participant_a=source) | Q(participant_b=source)
        )
    )
    for friendship in friendships:
        other_id = (
            friendship.participant_b_id
            if friendship.participant_a_id == source.id
            else friendship.participant_a_id
        )
        if other_id == destination.id:
            friendship.delete()
            continue

        duplicate, left_id, right_id = _friendship_duplicate(
            friendship=friendship,
            destination_id=destination.id,
            other_id=other_id,
        )
        if duplicate:
            _merge_friendship_duplicate(duplicate, friendship)
            friendship.delete()
            continue

        friendship.participant_a_id = left_id
        friendship.participant_b_id = right_id
        friendship.save(update_fields=["participant_a", "participant_b"])


def _merge_expense_shares(*, source, destination, model):
    shares = list(model.objects.select_for_update().filter(participant=source))
    for share in shares:
        duplicate = model.objects.filter(expense=share.expense, participant=destination).first()
        if duplicate:
            duplicate.amount += share.amount
            duplicate.save(update_fields=["amount"])
            share.delete()
            continue
        share.participant = destination
        share.save(update_fields=["participant"])


def _merge_settlements(*, source, destination):
    settlements = list(
        Settlement.objects.select_for_update().filter(
            Q(payer_participant=source) | Q(receiver_participant=source)
        )
    )
    for settlement in settlements:
        payer_id = destination.id if settlement.payer_participant_id == source.id else settlement.payer_participant_id
        receiver_id = (
            destination.id if settlement.receiver_participant_id == source.id else settlement.receiver_participant_id
        )
        if payer_id == receiver_id:
            if settlement.deleted_at is None:
                settlement.deleted_at = timezone.now()
                settlement.save(update_fields=["deleted_at", "updated_at"])
            continue
        settlement.payer_participant_id = payer_id
        settlement.receiver_participant_id = receiver_id
        settlement.save(update_fields=["payer_participant", "receiver_participant", "updated_at"])


def _merge_participant_records(*, source, destination):
    if source.id == destination.id:
        return
    _merge_group_memberships(source=source, destination=destination)
    _merge_friendships(source=source, destination=destination)
    _merge_expense_shares(source=source, destination=destination, model=ExpensePaymentShare)
    _merge_expense_shares(source=source, destination=destination, model=ExpenseOwedShare)
    _merge_settlements(source=source, destination=destination)
    Invitation.objects.filter(target_participant=source).update(target_participant=destination)
    source.user = None
    source.kind = source.Kind.UNREGISTERED
    source.save(update_fields=["user", "kind", "updated_at"])


def _claim_participant(*, actor, target):
    existing = getattr(actor, "participant", None)
    if existing and existing.id != target.id:
        _merge_participant_records(source=existing, destination=target)
    else:
        _remove_placeholder_participant(actor)
    target.user = actor
    target.kind = target.Kind.REGISTERED
    target.save(update_fields=["user", "kind", "updated_at"])


@transaction.atomic
def accept_invitation(*, actor, token: str):
    invitation = (
        Invitation.objects.select_for_update()
        .select_related("group", "target_participant", "invited_by")
        .get(token_hash=Invitation.hash_token(token))
    )
    if not invitation.is_valid():
        raise ValueError("Invitation is invalid or expired.")
    if invitation.type == Invitation.Type.GROUP_JOIN:
        participant = get_or_create_user_participant(actor)
        _, status = activate_group_membership(group=invitation.group, participant=participant)
        # Already-active members re-accepting an invite is a silent no-op so
        # the flow doesn't surface as an error. New + reactivated paths both
        # need friendships ensured and a "joined" event recorded.
        if status != "already_active":
            ensure_friendships_for_group(invitation.group)
            event = record_activity(
                actor,
                EventType.GROUP_MEMBER_JOINED,
                group=invitation.group,
                payload={"target_participant_id": participant.id},
            )
            create_notifications_for_activity(event)
    elif invitation.type == Invitation.Type.CLAIM_PARTICIPANT:
        target = invitation.target_participant
        if target.user_id and target.user_id != actor.id:
            raise ValueError("Participant has already been claimed.")
        _claim_participant(actor=actor, target=target)
        ensure_friendships_for_group(invitation.group)
        event = record_activity(
            actor,
            EventType.INVITATION_ACCEPTED,
            group=invitation.group,
            payload={"target_participant_id": target.id},
        )
        create_notifications_for_activity(event)
    elif invitation.type == Invitation.Type.FRIEND_JOIN:
        invited_by_participant = get_or_create_user_participant(invitation.invited_by)
        create_friendship(actor, invited_by_participant, Friendship.Source.EXPLICIT)
    else:
        raise ValueError("Unsupported invitation type.")
    invitation.accepted_by = actor
    invitation.accepted_at = timezone.now()
    invitation.save(update_fields=["accepted_by", "accepted_at"])
    return invitation

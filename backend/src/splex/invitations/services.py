from django.conf import settings
from django.db import transaction
from django.utils import timezone

from splex.activity.events import EventType
from splex.activity.services import record_activity
from splex.friends.models import Friendship
from splex.friends.services import create_friendship
from splex.groups.models import GroupMembership
from splex.groups.services import assert_group_member, ensure_friendships_for_group
from splex.invitations.models import Invitation
from splex.notifications.services import create_notifications_for_activity
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
        GroupMembership.objects.get_or_create(group=invitation.group, participant=participant)
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
        _remove_placeholder_participant(actor)
        target.user = actor
        target.kind = target.Kind.REGISTERED
        target.save(update_fields=["user", "kind", "updated_at"])
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

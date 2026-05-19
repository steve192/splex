from __future__ import annotations

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404

from splex.activity.events import EventType
from splex.activity.services import record_activity
from splex.friends.models import Friendship
from splex.notifications.services import create_notifications_for_activity
from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant


def accessible_friendships(user):
    participant = get_or_create_user_participant(user)
    return Friendship.objects.filter(
        Q(participant_a=participant) | Q(participant_b=participant),
        ended_at__isnull=True,
    ).distinct()


def ensure_friendship_member(user, friendship_id) -> tuple[Friendship, Participant]:
    participant = get_or_create_user_participant(user)
    friendship = get_object_or_404(
        Friendship,
        id=friendship_id,
        ended_at__isnull=True,
    )
    if participant.id not in (friendship.participant_a_id, friendship.participant_b_id):
        from django.http import Http404
        raise Http404("Friendship not found.")
    return friendship, participant


def other_participant(friendship: Friendship, current: Participant) -> Participant:
    return (
        friendship.participant_b
        if friendship.participant_a_id == current.id
        else friendship.participant_a
    )


@transaction.atomic
def create_friendship(actor, other_participant, source=Friendship.Source.EXPLICIT):
    actor_participant = get_or_create_user_participant(actor)
    if actor_participant.id == other_participant.id:
        raise ValueError("You cannot befriend yourself.")
    a, b = sorted([actor_participant, other_participant], key=lambda participant: participant.id)
    friendship = Friendship.objects.filter(
        participant_a=a,
        participant_b=b,
        ended_at__isnull=True,
    ).first()
    if not friendship:
        friendship = Friendship.objects.create(
            participant_a=a,
            participant_b=b,
            source=source,
            default_currency=actor.default_currency,
        )
    event = record_activity(
        actor,
        EventType.FRIEND_ACCEPTED,
        friendship=friendship,
        payload={"friendName": other_participant.display_name},
    )
    create_notifications_for_activity(event)
    return friendship

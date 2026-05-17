from django.db import transaction

from splex.activity.services import record_activity
from splex.friends.models import Friendship
from splex.notifications.services import create_notifications_for_activity
from splex.participants.services import get_or_create_user_participant


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
        "friend.accepted",
        friendship=friendship,
        payload={"friendName": other_participant.display_name},
    )
    create_notifications_for_activity(event)
    return friendship

from __future__ import annotations

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone

from splex.activity.events import EventType
from splex.activity.services import record_activity
from splex.friends.models import Friendship
from splex.notifications.services import create_notifications_for_activity
from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant
from splex.shared.errors import DomainError, ErrorCode


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


def set_friendship_archived(
    friendship: Friendship, participant: Participant, archived: bool
) -> Friendship:
    """Toggle the per-participant archive flag.  Archiving is personal - it only
    affects the caller's own list, never the friend's."""
    field = friendship.set_archived_for(participant, timezone.now() if archived else None)
    friendship.save(update_fields=[field, "updated_at"])
    return friendship


def end_friendship(actor, friendship: Friendship, participant: Participant) -> Friendship:
    """Soft-end (unfriend) a friendship for both sides.

    Refuses while the pair is not settled up - we never want removal to orphan
    money that is owed.  History is preserved via the `ended_at` soft delete, so
    the pair can be re-friended later and their shared expenses remain intact.
    Records a FRIEND_REMOVED activity event and notifies the other side, mirroring
    the FRIEND_ACCEPTED event recorded when the friendship was created.
    """
    from splex.balances.selectors import friendship_balance_for_participant

    if friendship_balance_for_participant(friendship, participant) != 0:
        raise DomainError(ErrorCode.FRIEND_NOT_SETTLED, "Settle up before removing this friend.")
    other = other_participant(friendship, participant)
    friendship.ended_at = timezone.now()
    friendship.save(update_fields=["ended_at", "updated_at"])
    event = record_activity(
        actor,
        EventType.FRIEND_REMOVED,
        friendship=friendship,
        payload={"friendName": other.effective_display_name},
    )
    create_notifications_for_activity(event)
    return friendship


@transaction.atomic
def active_friendship_for(
    participant_a: Participant, participant_b: Participant
) -> Friendship | None:
    """Return the active Friendship for the unordered pair, or None.

    Use this for existence checks; use `get_or_create_friendship` when you may
    need to create one.
    """
    a, b = sorted([participant_a, participant_b], key=lambda p: p.id)
    return Friendship.objects.filter(
        participant_a=a, participant_b=b, ended_at__isnull=True
    ).first()


def get_or_create_friendship(
    participant_a: Participant,
    participant_b: Participant,
    *,
    source: str,
    default_currency: str,
) -> tuple[Friendship, bool]:
    """Idempotent pair-based get-or-create. Returns (friendship, created).

    The unique constraint on Friendship is `(participant_a, participant_b)` with
    `ended_at IS NULL`, so this respects the model invariant and never produces
    duplicates regardless of `source`.
    """
    existing = active_friendship_for(participant_a, participant_b)
    if existing:
        return existing, False
    a, b = sorted([participant_a, participant_b], key=lambda p: p.id)
    return Friendship.objects.create(
        participant_a=a, participant_b=b, source=source, default_currency=default_currency
    ), True


def create_friendship(actor, other_participant, source=Friendship.Source.EXPLICIT):
    """Accept-an-invite entry point: ensures a friendship exists between `actor`
    and `other_participant` and records a FRIEND_ACCEPTED event on first creation
    only (re-acceptance is a silent no-op so we don't spam notifications)."""
    actor_participant = get_or_create_user_participant(actor)
    if actor_participant.id == other_participant.id:
        raise DomainError(ErrorCode.FRIEND_SELF, "You cannot befriend yourself.")
    friendship, created = get_or_create_friendship(
        actor_participant,
        other_participant,
        source=source,
        default_currency=actor.default_currency,
    )
    if not created:
        return friendship
    event = record_activity(
        actor,
        EventType.FRIEND_ACCEPTED,
        friendship=friendship,
        payload={"friendName": other_participant.display_name},
    )
    create_notifications_for_activity(event)
    return friendship

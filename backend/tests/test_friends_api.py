import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from splex.activity.events import EventType
from splex.activity.models import ActivityEvent
from splex.expenses.services import create_expense
from splex.friends.models import Friendship
from splex.friends.services import create_friendship
from splex.notifications.models import Notification
from splex.participants.services import get_or_create_user_participant


def _friendship_between(owner, friend_user):
    friend_p = get_or_create_user_participant(friend_user)
    return create_friendship(owner, friend_p)


@pytest.mark.django_db
def test_archive_is_per_participant():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    friend = User.objects.create_user(email="friend@example.com", display_name="Friend")
    friendship = _friendship_between(owner, friend)

    client = APIClient()
    client.force_authenticate(owner)
    response = client.patch(f"/api/friends/{friendship.id}/", {"archived": True}, format="json")
    assert response.status_code == 200
    assert response.data["archived_at"] is not None

    friendship.refresh_from_db()
    owner_p = get_or_create_user_participant(owner)
    # Only the caller's side is archived; the friend's view is untouched.
    assert friendship.archived_at_for(owner_p) is not None
    friend_p = get_or_create_user_participant(friend)
    assert friendship.archived_at_for(friend_p) is None

    friend_client = APIClient()
    friend_client.force_authenticate(friend)
    assert friend_client.get(f"/api/friends/{friendship.id}/").data["archived_at"] is None


@pytest.mark.django_db
def test_unarchive_clears_flag():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    friend = User.objects.create_user(email="friend@example.com", display_name="Friend")
    friendship = _friendship_between(owner, friend)

    client = APIClient()
    client.force_authenticate(owner)
    client.patch(f"/api/friends/{friendship.id}/", {"archived": True}, format="json")
    response = client.patch(f"/api/friends/{friendship.id}/", {"archived": False}, format="json")
    assert response.status_code == 200
    assert response.data["archived_at"] is None


@pytest.mark.django_db
def test_remove_blocked_while_balance_outstanding():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    friend = User.objects.create_user(email="friend@example.com", display_name="Friend")
    friendship = _friendship_between(owner, friend)
    owner_p = get_or_create_user_participant(owner)

    # Owner paid 10 split equally → friend owes owner 5, so neither side is settled.
    create_expense(
        actor=owner,
        friendship=friendship,
        data={
            "description": "Lunch",
            "amount": "10",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [{"participant_id": owner_p.id, "amount": "10"}],
        },
    )

    client = APIClient()
    client.force_authenticate(owner)
    response = client.delete(f"/api/friends/{friendship.id}/")
    assert response.status_code == 400

    friendship.refresh_from_db()
    assert friendship.ended_at is None


@pytest.mark.django_db
def test_remove_settled_friend_ends_friendship():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    friend = User.objects.create_user(email="friend@example.com", display_name="Friend")
    friendship = _friendship_between(owner, friend)

    client = APIClient()
    client.force_authenticate(owner)
    response = client.delete(f"/api/friends/{friendship.id}/")
    assert response.status_code == 204

    friendship.refresh_from_db()
    assert friendship.ended_at is not None
    # The pair drops out of the active friendship list for both sides.
    assert not Friendship.objects.filter(id=friendship.id, ended_at__isnull=True).exists()

    # Removal records a FRIEND_REMOVED activity event and notifies the other side,
    # mirroring the FRIEND_ACCEPTED event recorded on creation.
    event = ActivityEvent.objects.get(friendship=friendship, event_type=EventType.FRIEND_REMOVED)
    assert event.actor_id == owner.id
    assert Notification.objects.filter(activity_event=event, user=friend).exists()
    # The actor does not notify themselves.
    assert not Notification.objects.filter(activity_event=event, user=owner).exists()

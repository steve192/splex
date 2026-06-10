"""Tests for the user-triggered "remind me" push endpoints.

Group context covers both the per-debtor settle reminder and the
broadcast track-expense reminder.  Friendship context covers the
two-person equivalents.  The actual push transport is mocked so the
tests run offline; what we care about is who would have been pushed and
which translation template was used.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from splex.friends.services import create_friendship
from splex.groups.services import (
    add_registered_participant,
    add_unregistered_participant,
    create_group,
)
from splex.notifications.models import DeviceToken
from splex.participants.services import get_or_create_user_participant


def _user(email, name="X"):
    return get_user_model().objects.create_user(email=email, display_name=name)


def _enable_push(user):
    DeviceToken.objects.create(user=user, token=f"tok-{user.id}", platform="android")


def _client(user):
    api = APIClient()
    api.force_authenticate(user=user)
    return api


def _add_friend_to_group(*, actor, group, friend_user):
    """``add_registered_participant`` requires the two users to already be
    friends - mirror what the normal "invite a friend to my group" flow does
    so the tests can focus on the reminder logic."""
    friend_participant = get_or_create_user_participant(friend_user)
    create_friendship(actor, friend_participant)
    add_registered_participant(actor=actor, group=group, participant=friend_participant)
    return friend_participant


# ---------------------------------------------------------------------------
# Group: settle reminder
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_group_settle_reminder_sends_to_targeted_debtor():
    actor = _user("a@example.com", "Alice")
    bob = _user("b@example.com", "Bob")
    _enable_push(bob)
    group = create_group(actor=actor, name="Trip", default_currency="EUR")
    bob_participant = _add_friend_to_group(actor=actor, group=group, friend_user=bob)

    with patch("splex.notifications.services.send_expo_notification", return_value=None) as send:
        response = _client(actor).post(
            f"/api/groups/{group.id}/reminders/settle/",
            {"participant_id": bob_participant.id, "amount": "10.00", "currency": "EUR"},
            format="json",
        )

    assert response.status_code == 200
    assert response.data["sent"] is True
    assert send.call_count == 1
    call = send.call_args
    assert call.args[0] == f"tok-{bob.id}"
    assert "10.00" in call.kwargs["body"]
    assert call.kwargs["data"]["kind"] == "reminder.settle"


@pytest.mark.django_db
def test_group_settle_reminder_rejects_self_target():
    actor = _user("a@example.com")
    group = create_group(actor=actor, name="Trip", default_currency="EUR")
    actor_participant = get_or_create_user_participant(actor)
    response = _client(actor).post(
        f"/api/groups/{group.id}/reminders/settle/",
        {"participant_id": actor_participant.id, "amount": "10.00"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_group_settle_reminder_rejects_unregistered_target():
    """Unregistered placeholders have no user, so they have no push endpoint
    to send to - the API must surface a clear 400 instead of silently dropping
    the request."""
    actor = _user("a@example.com")
    group = create_group(actor=actor, name="Trip", default_currency="EUR")
    placeholder = add_unregistered_participant(
        actor=actor, group=group, display_name="Ghost",
    )
    response = _client(actor).post(
        f"/api/groups/{group.id}/reminders/settle/",
        {"participant_id": placeholder.id, "amount": "10.00"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_group_settle_reminder_requires_membership():
    actor = _user("a@example.com")
    outsider = _user("c@example.com")
    group = create_group(actor=actor, name="Trip", default_currency="EUR")
    actor_participant = get_or_create_user_participant(actor)
    response = _client(outsider).post(
        f"/api/groups/{group.id}/reminders/settle/",
        {"participant_id": actor_participant.id, "amount": "10.00"},
        format="json",
    )
    # ``assert_group_member`` raises PermissionError → mapped to 403/404.
    assert response.status_code in (403, 404)


@pytest.mark.django_db
def test_group_settle_reminder_rejects_target_outside_group():
    actor = _user("a@example.com")
    bob = _user("b@example.com")
    group = create_group(actor=actor, name="Trip", default_currency="EUR")
    bob_participant = get_or_create_user_participant(bob)
    # Bob is NOT a member of `group`.
    response = _client(actor).post(
        f"/api/groups/{group.id}/reminders/settle/",
        {"participant_id": bob_participant.id, "amount": "10.00"},
        format="json",
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_group_settle_reminder_returns_sent_false_when_no_push_endpoints():
    """A registered member with no push subscription is still a valid target.
    The endpoint reports ``sent: false`` rather than failing."""
    actor = _user("a@example.com")
    bob = _user("b@example.com")
    group = create_group(actor=actor, name="Trip", default_currency="EUR")
    bob_participant = _add_friend_to_group(actor=actor, group=group, friend_user=bob)
    response = _client(actor).post(
        f"/api/groups/{group.id}/reminders/settle/",
        {"participant_id": bob_participant.id, "amount": "10.00"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["sent"] is False


# ---------------------------------------------------------------------------
# Group: track-expense reminder
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_group_track_expense_reminder_pings_every_other_member():
    actor = _user("a@example.com", "Alice")
    bob = _user("b@example.com", "Bob")
    carol = _user("c@example.com", "Carol")
    _enable_push(bob)
    _enable_push(carol)
    group = create_group(actor=actor, name="Trip", default_currency="EUR")
    _add_friend_to_group(actor=actor, group=group, friend_user=bob)
    _add_friend_to_group(actor=actor, group=group, friend_user=carol)

    with patch("splex.notifications.services.send_expo_notification", return_value=None) as send:
        response = _client(actor).post(
            f"/api/groups/{group.id}/reminders/track-expense/", {}, format="json",
        )

    assert response.status_code == 200
    assert response.data == {"recipients": 2, "sent": 2}
    pushed_tokens = sorted(call.args[0] for call in send.call_args_list)
    assert pushed_tokens == sorted([f"tok-{bob.id}", f"tok-{carol.id}"])


@pytest.mark.django_db
def test_group_track_expense_reminder_skips_unregistered_members():
    """Unregistered placeholders should not be counted as recipients."""
    actor = _user("a@example.com")
    group = create_group(actor=actor, name="Trip", default_currency="EUR")
    add_unregistered_participant(actor=actor, group=group, display_name="Ghost")
    response = _client(actor).post(
        f"/api/groups/{group.id}/reminders/track-expense/", {}, format="json",
    )
    assert response.status_code == 200
    assert response.data == {"recipients": 0, "sent": 0}


# ---------------------------------------------------------------------------
# Friend: settle reminder
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_friend_settle_reminder_sends_to_other_side():
    actor = _user("a@example.com", "Alice")
    bob = _user("b@example.com", "Bob")
    _enable_push(bob)
    friendship = create_friendship(actor, get_or_create_user_participant(bob))

    with patch("splex.notifications.services.send_expo_notification", return_value=None) as send:
        response = _client(actor).post(
            f"/api/friends/{friendship.id}/reminders/settle/",
            {"amount": "12.50", "currency": "EUR"},
            format="json",
        )

    assert response.status_code == 200
    assert response.data["sent"] is True
    assert send.call_args.args[0] == f"tok-{bob.id}"
    assert "12.50" in send.call_args.kwargs["body"]


@pytest.mark.django_db
def test_friend_settle_reminder_rejects_missing_amount_when_no_debt():
    """No amount + zero balance → 400, not a misleading reminder for €0."""
    actor = _user("a@example.com")
    bob = _user("b@example.com")
    friendship = create_friendship(actor, get_or_create_user_participant(bob))
    response = _client(actor).post(
        f"/api/friends/{friendship.id}/reminders/settle/", {}, format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_friend_settle_reminder_requires_friendship_membership():
    outsider = _user("c@example.com")
    actor = _user("a@example.com")
    bob = _user("b@example.com")
    friendship = create_friendship(actor, get_or_create_user_participant(bob))
    response = _client(outsider).post(
        f"/api/friends/{friendship.id}/reminders/settle/",
        {"amount": "5.00"},
        format="json",
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Friend: track-expense reminder
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_friend_track_expense_reminder_pings_other_friend():
    actor = _user("a@example.com")
    bob = _user("b@example.com")
    _enable_push(bob)
    friendship = create_friendship(actor, get_or_create_user_participant(bob))
    with patch("splex.notifications.services.send_expo_notification", return_value=None) as send:
        response = _client(actor).post(
            f"/api/friends/{friendship.id}/reminders/track-expense/", {}, format="json",
        )
    assert response.status_code == 200
    assert response.data["sent"] is True
    assert send.call_args.kwargs["data"]["kind"] == "reminder.track_expense.friend"

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model

from splex.activity.events import EventType
from splex.activity.services import record_activity
from splex.groups.services import create_group
from splex.notifications.models import DeviceToken, Notification, WebPushSubscription
from splex.notifications.services import (
    TerminalDispatchError,
    create_notifications_for_activity,
    dispatch_pending_notifications,
)


def _setup_group_with_two_users():
    User = get_user_model()
    actor = User.objects.create_user(email="actor@example.com", display_name="Actor")
    receiver = User.objects.create_user(email="receiver@example.com", display_name="Recv")
    group = create_group(actor=actor, name="Test", default_currency="EUR")
    # Add receiver via direct membership to skip invitation flow.
    from splex.groups.models import GroupMembership
    from splex.participants.services import get_or_create_user_participant

    GroupMembership.objects.create(group=group, participant=get_or_create_user_participant(receiver))
    return actor, receiver, group


@pytest.mark.django_db
def test_dispatch_sends_to_each_device_token_and_marks_sent():
    actor, receiver, group = _setup_group_with_two_users()
    DeviceToken.objects.create(user=receiver, token="ExponentPushToken[abc]", platform="android")
    DeviceToken.objects.create(user=receiver, token="ExponentPushToken[def]", platform="android")

    event = record_activity(actor, EventType.EXPENSE_CREATED, group=group, payload={"description": "X"})
    create_notifications_for_activity(event)

    sent_tokens = []
    with patch(
        "splex.notifications.services.send_expo_notification",
        side_effect=lambda token, _n, _t, _b: sent_tokens.append(token),
    ):
        notification = Notification.objects.get(user=receiver)
        dispatch_pending_notifications([notification.id])
        notification.refresh_from_db()

    assert notification.status == Notification.Status.SENT
    assert set(sent_tokens) == {"ExponentPushToken[abc]", "ExponentPushToken[def]"}


@pytest.mark.django_db
def test_dispatch_marks_failed_when_no_subscriptions():
    actor, receiver, group = _setup_group_with_two_users()
    event = record_activity(actor, EventType.EXPENSE_CREATED, group=group, payload={"description": "X"})
    create_notifications_for_activity(event)

    notification = Notification.objects.get(user=receiver)
    dispatch_pending_notifications([notification.id])
    notification.refresh_from_db()
    assert notification.status == Notification.Status.FAILED
    assert "No enabled push subscription" in notification.error


@pytest.mark.django_db
def test_terminal_error_deletes_device_token():
    actor, receiver, group = _setup_group_with_two_users()
    DeviceToken.objects.create(user=receiver, token="dead-token", platform="android")
    DeviceToken.objects.create(user=receiver, token="live-token", platform="android")

    def side_effect(token, _n, _t, _b):
        if token == "dead-token":
            raise TerminalDispatchError("DeviceNotRegistered")
        # live-token succeeds silently

    event = record_activity(actor, EventType.EXPENSE_CREATED, group=group, payload={"description": "X"})
    create_notifications_for_activity(event)
    notification = Notification.objects.get(user=receiver)

    with patch("splex.notifications.services.send_expo_notification", side_effect=side_effect):
        dispatch_pending_notifications([notification.id])

    notification.refresh_from_db()
    assert notification.status == Notification.Status.SENT  # live-token went through
    assert not DeviceToken.objects.filter(token="dead-token").exists()
    assert DeviceToken.objects.filter(token="live-token").exists()


@pytest.mark.django_db
def test_terminal_error_deletes_web_push_subscription():
    actor, receiver, group = _setup_group_with_two_users()
    WebPushSubscription.objects.create(
        user=receiver, endpoint="https://example.com/dead", p256dh="x", auth="y"
    )

    event = record_activity(actor, EventType.EXPENSE_CREATED, group=group, payload={"description": "X"})
    create_notifications_for_activity(event)
    notification = Notification.objects.get(user=receiver)

    with patch(
        "splex.notifications.services.send_web_push_notification",
        side_effect=TerminalDispatchError("HTTP 410"),
    ):
        dispatch_pending_notifications([notification.id])

    assert not WebPushSubscription.objects.filter(endpoint="https://example.com/dead").exists()


@pytest.mark.django_db
def test_non_terminal_error_keeps_token_for_retry():
    actor, receiver, group = _setup_group_with_two_users()
    DeviceToken.objects.create(user=receiver, token="flaky-token", platform="android")

    event = record_activity(actor, EventType.EXPENSE_CREATED, group=group, payload={"description": "X"})
    create_notifications_for_activity(event)
    notification = Notification.objects.get(user=receiver)

    with patch(
        "splex.notifications.services.send_expo_notification",
        side_effect=RuntimeError("transient 502"),
    ):
        dispatch_pending_notifications([notification.id])

    notification.refresh_from_db()
    assert notification.status == Notification.Status.FAILED
    # Transient errors leave the token in place for the next attempt.
    assert DeviceToken.objects.filter(token="flaky-token").exists()


@pytest.mark.django_db
def test_dispatch_excludes_actor_from_recipients():
    actor, _receiver, group = _setup_group_with_two_users()
    event = record_activity(actor, EventType.EXPENSE_CREATED, group=group, payload={"description": "X"})
    created = create_notifications_for_activity(event)
    # Actor must not receive their own notification.
    recipient_ids = {n.user_id for n in created}
    assert actor.id not in recipient_ids

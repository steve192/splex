from base64 import b64encode
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings

from splex.activity.events import EventType
from splex.activity.services import record_activity
from splex.groups.services import create_group
from splex.notifications.models import (
    DeviceToken,
    ExpoPushTicket,
    Notification,
    WebPushSubscription,
)
from splex.notifications.services import (
    TerminalDispatchError,
    create_notifications_for_activity,
    dispatch_pending_notifications,
    generate_vapid_key,
    get_active_vapid_key,
    send_web_push_notification,
)


def _expense_created_event(actor, group):
    return record_activity(
        actor,
        EventType.EXPENSE_CREATED,
        group=group,
        payload={"description": "X"},
    )


def _setup_group_with_two_users():
    user_model = get_user_model()
    actor = user_model.objects.create_user(email="actor@example.com", display_name="Actor")
    receiver = user_model.objects.create_user(email="receiver@example.com", display_name="Recv")
    group = create_group(actor=actor, name="Test", default_currency="EUR")
    # Add receiver via direct membership to skip invitation flow.
    from splex.groups.models import GroupMembership
    from splex.participants.services import get_or_create_user_participant

    GroupMembership.objects.create(
        group=group,
        participant=get_or_create_user_participant(receiver),
    )
    return actor, receiver, group


@pytest.mark.django_db
def test_dispatch_sends_to_each_device_token_and_marks_sent():
    actor, receiver, group = _setup_group_with_two_users()
    DeviceToken.objects.create(user=receiver, token="ExponentPushToken[abc]", platform="android")
    DeviceToken.objects.create(user=receiver, token="ExponentPushToken[def]", platform="android")

    event = _expense_created_event(actor, group)
    create_notifications_for_activity(event)

    sent_tokens = []
    with patch(
        "splex.notifications.services.send_expo_notification",
        side_effect=lambda token, **_kwargs: sent_tokens.append(token),
    ):
        notification = Notification.objects.get(user=receiver)
        dispatch_pending_notifications([notification.id])
        notification.refresh_from_db()

    assert notification.status == Notification.Status.SENT
    assert set(sent_tokens) == {"ExponentPushToken[abc]", "ExponentPushToken[def]"}


@pytest.mark.django_db
def test_dispatch_marks_failed_when_no_subscriptions():
    actor, receiver, group = _setup_group_with_two_users()
    event = _expense_created_event(actor, group)
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

    def side_effect(token, **_kwargs):
        if token == "dead-token":
            raise TerminalDispatchError("DeviceNotRegistered")
        # live-token succeeds silently

    event = _expense_created_event(actor, group)
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

    event = _expense_created_event(actor, group)
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

    event = _expense_created_event(actor, group)
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
def test_dispatch_records_expo_ticket_for_receipt_check():
    actor, receiver, group = _setup_group_with_two_users()
    device = DeviceToken.objects.create(
        user=receiver, token="ExponentPushToken[abc]", platform="android"
    )

    event = _expense_created_event(actor, group)
    create_notifications_for_activity(event)
    notification = Notification.objects.get(user=receiver)

    with patch(
        "splex.notifications.services.send_expo_notification", return_value="ticket-42"
    ):
        dispatch_pending_notifications([notification.id])

    assert ExpoPushTicket.objects.filter(device_token=device, ticket_id="ticket-42").exists()
    # The accepted ticket is not yet a confirmed delivery.
    device.refresh_from_db()
    assert device.last_success_at is None


@pytest.mark.django_db
def test_dispatch_marks_web_push_delivery_success():
    actor, receiver, group = _setup_group_with_two_users()
    subscription = WebPushSubscription.objects.create(
        user=receiver, endpoint="https://example.com/ok", p256dh="x", auth="y"
    )

    event = _expense_created_event(actor, group)
    create_notifications_for_activity(event)
    notification = Notification.objects.get(user=receiver)

    with patch("splex.notifications.services.send_web_push_notification"):
        dispatch_pending_notifications([notification.id])

    subscription.refresh_from_db()
    assert subscription.last_success_at is not None


@pytest.mark.django_db
@pytest.mark.parametrize("status_code", [401, 403, 404, 410])
def test_send_web_push_vapid_or_gone_errors_are_terminal(status_code):
    """401/403 (VAPID key mismatch) make a subscription permanently
    unsendable, exactly like a 404/410 - all must raise the terminal error so
    the dispatcher deletes the row instead of retrying forever."""
    from pywebpush import WebPushException

    _actor, receiver, _group = _setup_group_with_two_users()
    subscription = WebPushSubscription.objects.create(
        user=receiver, endpoint="https://example.com/mismatch", p256dh="x", auth="y"
    )
    generate_vapid_key()

    error = WebPushException("rejected", response=type("R", (), {"status_code": status_code})())
    with patch("pywebpush.webpush", side_effect=error):
        with pytest.raises(TerminalDispatchError):
            send_web_push_notification(subscription, title="T", body="B", data={})


@pytest.mark.django_db
def test_dispatch_excludes_actor_from_recipients():
    actor, _receiver, group = _setup_group_with_two_users()
    event = _expense_created_event(actor, group)
    created = create_notifications_for_activity(event)
    # Actor must not receive their own notification.
    recipient_ids = {n.user_id for n in created}
    assert actor.id not in recipient_ids


@pytest.mark.django_db
def test_get_active_vapid_key_normalizes_escaped_newlines_from_settings():
    generated = generate_vapid_key()
    escaped_private_key = generated.private_key.replace("\n", "\\n")

    with override_settings(
        VAPID_PUBLIC_KEY=generated.public_key,
        VAPID_PRIVATE_KEY=escaped_private_key,
    ):
        active_key = get_active_vapid_key()

    assert active_key.public_key == generated.public_key
    assert active_key.private_key == generated.private_key


@pytest.mark.django_db
def test_get_active_vapid_key_decodes_base64_pem_from_settings():
    generated = generate_vapid_key()
    encoded_private_key = b64encode(generated.private_key.encode("utf-8")).decode("ascii")

    with override_settings(
        VAPID_PUBLIC_KEY=generated.public_key,
        VAPID_PRIVATE_KEY=encoded_private_key,
    ):
        active_key = get_active_vapid_key()

    assert active_key.private_key == generated.private_key


@pytest.mark.django_db
def test_get_active_vapid_key_rejects_invalid_configured_private_key():
    with override_settings(
        VAPID_PUBLIC_KEY="public",
        VAPID_PRIVATE_KEY="not-a-valid-private-key",
    ):
        with pytest.raises(ValueError, match="Configured VAPID_PRIVATE_KEY is not valid"):
            get_active_vapid_key()


@pytest.mark.django_db
def test_get_active_vapid_key_rotates_invalid_persisted_key():
    invalid_key = generate_vapid_key()
    invalid_key.private_key = "not-a-valid-private-key"
    invalid_key.save(update_fields=["private_key"])

    with override_settings(VAPID_PUBLIC_KEY="", VAPID_PRIVATE_KEY=""):
        active_key = get_active_vapid_key()

    invalid_key.refresh_from_db()
    assert invalid_key.active is False
    assert active_key.id != invalid_key.id
    assert active_key.active is True
    assert "-----BEGIN" in active_key.private_key


@pytest.mark.django_db
def test_send_web_push_uses_vapid_instance_for_generated_pem_key():
    actor, receiver, group = _setup_group_with_two_users()
    subscription = WebPushSubscription.objects.create(
        user=receiver,
        endpoint="https://example.com/push",
        p256dh="p256dh-key",
        auth="auth-key",
    )
    event = _expense_created_event(actor, group)
    notification = Notification.objects.create(
        user=receiver,
        activity_event=event,
        title_key="activity.expense_created.title",
        body_key="activity.expense_created.body",
        payload={"description": "X"},
    )
    generate_vapid_key()

    with patch("pywebpush.webpush") as mock_webpush:
        send_web_push_notification(
            subscription, title="Title", body="Body", data=notification.payload,
        )

    assert mock_webpush.call_count == 1
    vapid_private_key = mock_webpush.call_args.kwargs["vapid_private_key"]
    assert hasattr(vapid_private_key, "sign")

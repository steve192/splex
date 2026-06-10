"""Tests for push endpoint lifecycle cleanup.

Covers the invariants behind the cleanup_push_endpoints / check_expo_receipts
jobs: endpoints are deleted when the push service confirms they are dead or
when their TTL expires (no re-registration and no confirmed delivery), and
Expo receipts are the source of truth for Expo token health.
"""

from datetime import timedelta
from unittest.mock import Mock, patch

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone

from splex.notifications.models import DeviceToken, ExpoPushTicket, WebPushSubscription
from splex.notifications.services import (
    EXPO_RECEIPT_CHECK_DELAY,
    EXPO_RECEIPT_MAX_AGE,
    check_expo_push_receipts,
    purge_expired_push_endpoints,
)


def _user(email="user@example.com"):
    return get_user_model().objects.create_user(email=email, display_name="User")


def _age(instance, days=0, **kwargs):
    """Backdate auto_now fields, which save() would otherwise overwrite."""
    delta = timedelta(days=days, **kwargs)
    type(instance).objects.filter(pk=instance.pk).update(
        updated_at=timezone.now() - delta, created_at=timezone.now() - delta
    )
    instance.refresh_from_db()


def _age_ticket(ticket, **kwargs):
    ExpoPushTicket.objects.filter(pk=ticket.pk).update(
        created_at=timezone.now() - timedelta(**kwargs)
    )


@pytest.mark.django_db
def test_ttl_purge_deletes_endpoints_without_sign_of_life():
    user = _user()
    expired_enabled = DeviceToken.objects.create(
        user=user, platform="android", token="expired-enabled"
    )
    expired_disabled = DeviceToken.objects.create(
        user=user, platform="android", token="expired-disabled", enabled=False
    )
    expired_subscription = WebPushSubscription.objects.create(
        user=user, endpoint="https://push/expired", p256dh="k", auth="a"
    )
    _age(expired_enabled, days=366)
    _age(expired_disabled, days=366)
    _age(expired_subscription, days=366)

    tokens_deleted, subscriptions_deleted = purge_expired_push_endpoints(365)

    assert tokens_deleted == 2
    assert subscriptions_deleted == 1
    assert not DeviceToken.objects.exists()
    assert not WebPushSubscription.objects.exists()


@pytest.mark.django_db
def test_ttl_purge_keeps_recently_registered_endpoints():
    user = _user()
    DeviceToken.objects.create(user=user, platform="android", token="fresh")
    WebPushSubscription.objects.create(
        user=user, endpoint="https://push/fresh", p256dh="k", auth="a"
    )

    tokens_deleted, subscriptions_deleted = purge_expired_push_endpoints(365)

    assert (tokens_deleted, subscriptions_deleted) == (0, 0)
    assert DeviceToken.objects.count() == 1
    assert WebPushSubscription.objects.count() == 1


@pytest.mark.django_db
def test_ttl_purge_keeps_endpoint_with_recent_confirmed_delivery():
    """A device that still receives pushes but whose user never opens the app
    must not lose its token: a confirmed delivery counts as a sign of life."""
    user = _user()
    delivered = DeviceToken.objects.create(user=user, platform="android", token="delivered")
    _age(delivered, days=400)
    DeviceToken.objects.filter(pk=delivered.pk).update(
        last_success_at=timezone.now() - timedelta(days=10)
    )

    tokens_deleted, _subscriptions_deleted = purge_expired_push_endpoints(365)

    assert tokens_deleted == 0
    assert DeviceToken.objects.filter(token="delivered").exists()


def _receipt_response(receipts):
    response = Mock()
    response.json.return_value = {"data": receipts}
    response.raise_for_status.return_value = None
    return response


@pytest.mark.django_db
def test_receipt_check_deletes_dead_token_and_confirms_live_one():
    user = _user()
    dead = DeviceToken.objects.create(user=user, platform="android", token="dead")
    live = DeviceToken.objects.create(user=user, platform="android", token="live")
    dead_ticket = ExpoPushTicket.objects.create(device_token=dead, ticket_id="t-dead")
    live_ticket = ExpoPushTicket.objects.create(device_token=live, ticket_id="t-live")
    _age_ticket(dead_ticket, minutes=45)
    _age_ticket(live_ticket, minutes=45)

    receipts = {
        "t-dead": {
            "status": "error",
            "message": "device gone",
            "details": {"error": "DeviceNotRegistered"},
        },
        "t-live": {"status": "ok"},
    }
    with patch("requests.post", return_value=_receipt_response(receipts)):
        checked, deleted = check_expo_push_receipts()

    assert (checked, deleted) == (2, 1)
    assert not DeviceToken.objects.filter(token="dead").exists()
    live.refresh_from_db()
    assert live.last_success_at is not None
    assert not ExpoPushTicket.objects.exists()


@pytest.mark.django_db
def test_receipt_check_waits_for_pending_receipts_but_expires_old_tickets():
    user = _user()
    device = DeviceToken.objects.create(user=user, platform="android", token="tok")
    pending = ExpoPushTicket.objects.create(device_token=device, ticket_id="t-pending")
    expired = ExpoPushTicket.objects.create(device_token=device, ticket_id="t-expired")
    ExpoPushTicket.objects.create(device_token=device, ticket_id="t-young")
    _age_ticket(pending, minutes=45)
    _age_ticket(expired, hours=25)

    with patch("requests.post", return_value=_receipt_response({})) as mock_post:
        check_expo_push_receipts()

    queried_ids = mock_post.call_args.kwargs["json"]["ids"]
    # Tickets younger than the check delay are not queried yet.
    assert "t-young" not in queried_ids
    # No receipt yet: keep waiting within Expo's retention window, give up after.
    assert ExpoPushTicket.objects.filter(ticket_id="t-pending").exists()
    assert not ExpoPushTicket.objects.filter(ticket_id="t-expired").exists()
    assert ExpoPushTicket.objects.filter(ticket_id="t-young").exists()
    # The token itself is never deleted just because a receipt went missing.
    assert DeviceToken.objects.filter(pk=device.pk).exists()


@pytest.mark.django_db
def test_receipt_check_handles_multiple_tickets_for_deleted_token():
    user = _user()
    device = DeviceToken.objects.create(user=user, platform="android", token="dead")
    first = ExpoPushTicket.objects.create(device_token=device, ticket_id="t-1")
    second = ExpoPushTicket.objects.create(device_token=device, ticket_id="t-2")
    _age_ticket(first, minutes=45)
    _age_ticket(second, minutes=45)

    receipts = {
        "t-1": {"status": "error", "details": {"error": "DeviceNotRegistered"}},
        "t-2": {"status": "ok"},
    }
    with patch("requests.post", return_value=_receipt_response(receipts)):
        _checked, deleted = check_expo_push_receipts()

    assert deleted == 1
    assert not DeviceToken.objects.filter(token="dead").exists()
    assert not ExpoPushTicket.objects.exists()


@pytest.mark.django_db
def test_cleanup_command_purges_expired_endpoints(settings):
    settings.PUSH_TOKEN_TTL_DAYS = 365
    user = _user()
    expired = DeviceToken.objects.create(user=user, platform="android", token="expired")
    fresh = DeviceToken.objects.create(user=user, platform="android", token="fresh")
    _age(expired, days=400)

    call_command("cleanup_push_endpoints")

    assert not DeviceToken.objects.filter(token="expired").exists()
    assert DeviceToken.objects.filter(pk=fresh.pk).exists()


@pytest.mark.django_db
def test_cleanup_command_can_be_disabled(settings):
    settings.PUSH_TOKEN_TTL_DAYS = 0
    user = _user()
    ancient = DeviceToken.objects.create(user=user, platform="android", token="ancient")
    _age(ancient, days=4000)

    call_command("cleanup_push_endpoints")

    assert DeviceToken.objects.filter(token="ancient").exists()


# Sanity guard for the constants the timing tests above rely on.
def test_receipt_timing_constants():
    assert EXPO_RECEIPT_CHECK_DELAY < EXPO_RECEIPT_MAX_AGE

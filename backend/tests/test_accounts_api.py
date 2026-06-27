from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from splex.groups.models import GroupMembership
from splex.groups.services import create_group
from splex.notifications.models import DeviceToken, WebPushSubscription
from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_me_returns_locale():
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U", locale="de")
    response = _auth_client(user).get("/api/me/")
    assert response.status_code == 200
    assert response.data["locale"] == "de"


@pytest.mark.django_db
def test_me_patch_updates_locale():
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U")
    response = _auth_client(user).patch("/api/me/", {"locale": "de"}, format="json")
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.locale == "de"


@pytest.mark.django_db
def test_me_patch_normalizes_default_currency_to_uppercase():
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U")
    response = _auth_client(user).patch("/api/me/", {"default_currency": "usd"}, format="json")
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.default_currency == "USD"


@pytest.mark.django_db
def test_me_patch_no_longer_syncs_to_participant_display_name():
    """The denormalized sync was removed; participant.display_name stays whatever it was.
    The participant.effective_display_name property derives the live name from the user."""
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="Old")
    participant = get_or_create_user_participant(user)
    # Force a stale value.
    Participant.objects.filter(id=participant.id).update(display_name="stale")

    _auth_client(user).patch("/api/me/", {"display_name": "New"}, format="json")

    participant.refresh_from_db()
    assert participant.display_name == "stale"  # column not synced anymore
    user.refresh_from_db()
    assert user.display_name == "New"
    assert participant.effective_display_name == "New"  # property reflects current user


@pytest.mark.django_db
def test_me_patch_updates_push_enabled():
    user_model = get_user_model()
    user = user_model.objects.create_user(
        email="u@example.com",
        display_name="U",
        push_enabled=True,
    )
    _auth_client(user).patch("/api/me/", {"push_enabled": False}, format="json")
    user.refresh_from_db()
    assert user.push_enabled is False


@pytest.mark.django_db
def test_token_refresh_records_activity_and_clears_retention_warnings():
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U")
    stale = timezone.now() - timedelta(days=170)
    user_model.objects.filter(pk=user.pk).update(
        last_login=stale,
        retention_first_notice_sent_at=stale,
        retention_second_notice_sent_at=stale,
    )
    refresh = str(RefreshToken.for_user(user))

    response = APIClient().post(
        "/api/auth/token/refresh/",
        {"refresh": refresh},
        format="json",
    )

    assert response.status_code == 200
    assert "access" in response.data
    user.refresh_from_db()
    assert user.last_login > stale
    assert user.retention_first_notice_sent_at is None
    assert user.retention_second_notice_sent_at is None


@pytest.mark.django_db
def test_token_refresh_keeps_recent_clean_activity_throttled():
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U")
    recent = timezone.now() - timedelta(hours=1)
    user_model.objects.filter(pk=user.pk).update(last_login=recent)
    refresh = str(RefreshToken.for_user(user))

    response = APIClient().post(
        "/api/auth/token/refresh/",
        {"refresh": refresh},
        format="json",
    )

    assert response.status_code == 200
    user.refresh_from_db()
    assert user.last_login == recent


# ---------------------------------------------------------------------------
# DELETE /api/me/delete/ - account deletion
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_delete_account_removes_user_and_solo_group():
    """Deleting an account soft-deletes groups where the user is the only member."""
    user_model = get_user_model()
    user = user_model.objects.create_user(email="solo@example.com", display_name="Solo")
    group = create_group(actor=user, name="Solo Trip", default_currency="EUR")

    response = _auth_client(user).delete("/api/me/delete/")
    assert response.status_code == 204

    # User is gone.
    assert not user_model.objects.filter(email="solo@example.com").exists()
    # Solo group was soft-deleted.
    group.refresh_from_db()
    assert group.deleted_at is not None


@pytest.mark.django_db
def test_delete_account_converts_participant_to_placeholder_in_shared_group():
    """In a group with other registered members the leaving user becomes an
    unregistered placeholder; no data is lost."""
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com", display_name="Owner")
    other = user_model.objects.create_user(email="other@example.com", display_name="Other")
    group = create_group(actor=owner, name="Shared Trip", default_currency="EUR")
    other_p = get_or_create_user_participant(other)
    GroupMembership.objects.create(group=group, participant=other_p)

    response = _auth_client(owner).delete("/api/me/delete/")
    assert response.status_code == 204

    # Owner's user row is gone.
    assert not user_model.objects.filter(email="owner@example.com").exists()

    # Group still exists.
    group.refresh_from_db()
    assert group.deleted_at is None

    # An unregistered placeholder replaced the owner in the group.
    placeholder = Participant.objects.filter(
        kind=Participant.Kind.UNREGISTERED,
        group_memberships__group=group,
        group_memberships__removed_at__isnull=True,
    ).exclude(id=other_p.id).first()
    assert placeholder is not None
    assert placeholder.display_name == "Owner"


@pytest.mark.django_db
def test_delete_account_removes_push_tokens():
    """Push tokens and web-push subscriptions are cleaned up on deletion."""
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U")
    DeviceToken.objects.create(user=user, platform="android", token="tok")
    WebPushSubscription.objects.create(user=user, endpoint="https://ep", p256dh="pk", auth="auth")

    response = _auth_client(user).delete("/api/me/delete/")
    assert response.status_code == 204

    assert not DeviceToken.objects.filter(token="tok").exists()
    assert not WebPushSubscription.objects.filter(endpoint="https://ep").exists()


@pytest.mark.django_db
def test_device_token_missing_field_returns_400_not_500():
    """A malformed device-token registration must be a clean 400, not a 500."""
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U")

    response = _auth_client(user).post(
        "/api/notifications/device-tokens/", {}, format="json"
    )
    assert response.status_code == 400
    assert not DeviceToken.objects.filter(user=user).exists()


@pytest.mark.django_db
def test_device_token_registration_succeeds():
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U")

    response = _auth_client(user).post(
        "/api/notifications/device-tokens/",
        {"token": "abc123", "platform": "android"},
        format="json",
    )
    assert response.status_code == 204
    assert DeviceToken.objects.filter(user=user, token="abc123").exists()


@pytest.mark.django_db
def test_device_token_registration_moves_token_to_new_account():
    """A device belongs to one account: registering its token under a second
    user must take it away from the first, so the previous account never
    receives notifications on a device it is no longer logged in on."""
    user_model = get_user_model()
    first = user_model.objects.create_user(email="first@example.com", display_name="First")
    second = user_model.objects.create_user(email="second@example.com", display_name="Second")
    DeviceToken.objects.create(user=first, platform="android", token="shared-device")

    response = _auth_client(second).post(
        "/api/notifications/device-tokens/",
        {"token": "shared-device", "platform": "android"},
        format="json",
    )
    assert response.status_code == 204

    rows = DeviceToken.objects.filter(token="shared-device")
    assert rows.count() == 1
    assert rows.get().user == second


@pytest.mark.django_db
def test_web_push_registration_moves_endpoint_to_new_account():
    user_model = get_user_model()
    first = user_model.objects.create_user(email="first@example.com", display_name="First")
    second = user_model.objects.create_user(email="second@example.com", display_name="Second")
    WebPushSubscription.objects.create(
        user=first, endpoint="https://push/shared", p256dh="old", auth="old"
    )

    response = _auth_client(second).post(
        "/api/notifications/web-push-subscriptions/",
        {"endpoint": "https://push/shared", "keys": {"p256dh": "new", "auth": "new"}},
        format="json",
    )
    assert response.status_code == 204

    rows = WebPushSubscription.objects.filter(endpoint="https://push/shared")
    assert rows.count() == 1
    subscription = rows.get()
    assert subscription.user == second
    assert subscription.p256dh == "new"


@pytest.mark.django_db
def test_web_push_subscription_missing_keys_returns_400_not_500():
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U")

    response = _auth_client(user).post(
        "/api/notifications/web-push-subscriptions/",
        {"endpoint": "https://ep"},
        format="json",
    )
    assert response.status_code == 400
    assert not WebPushSubscription.objects.filter(user=user).exists()

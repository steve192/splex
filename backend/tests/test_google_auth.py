"""Tests for Google auth: providers endpoint and ID token login."""

from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


def _google_tokeninfo(
    email="user@example.com",
    aud="web-client-id",
    verified=True,
    name="Test User",
):
    """Return a mock tokeninfo response payload."""
    return {
        "iss": "https://accounts.google.com",
        "sub": "1234567890",
        "aud": aud,
        "email": email,
        "email_verified": "true" if verified else "false",
        "name": name,
    }


def _mock_get_ok(payload):
    """Patch requests.get to return a successful tokeninfo response."""
    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None
    mock_resp.json.return_value = payload
    return patch("splex.accounts.services.http_requests.get", return_value=mock_resp)


@pytest.mark.django_db
def test_google_login_creates_user_and_returns_tokens(settings):
    settings.GOOGLE_CLIENT_ID = "web-client-id"

    with _mock_get_ok(_google_tokeninfo()):
        response = APIClient().post(
            "/api/auth/google/",
            {"id_token": "fake-token"},
            format="json",
        )

    assert response.status_code == 200
    assert "access" in response.data["tokens"]
    assert "refresh" in response.data["tokens"]
    assert response.data["user"]["email"] == "user@example.com"
    assert response.data["tokens"]["created"] is True


@pytest.mark.django_db
def test_google_login_finds_existing_user(settings):
    settings.GOOGLE_CLIENT_ID = "web-client-id"

    user_model = get_user_model()
    user_model.objects.create_user(email="user@example.com", display_name="Existing")

    with _mock_get_ok(_google_tokeninfo()):
        response = APIClient().post(
            "/api/auth/google/",
            {"id_token": "fake-token"},
            format="json",
        )

    assert response.status_code == 200
    assert response.data["tokens"]["created"] is False
    assert user_model.objects.filter(email="user@example.com").count() == 1


@pytest.mark.django_db
def test_google_login_uses_android_client_id(settings):
    settings.GOOGLE_CLIENT_ID = ""
    settings.GOOGLE_ANDROID_CLIENT_ID = "android-client-id"

    with _mock_get_ok(_google_tokeninfo(aud="android-client-id")):
        response = APIClient().post(
            "/api/auth/google/",
            {"id_token": "fake-token"},
            format="json",
        )

    assert response.status_code == 200


@pytest.mark.django_db
def test_google_login_rejects_wrong_audience(settings):
    settings.GOOGLE_CLIENT_ID = "web-client-id"

    with _mock_get_ok(_google_tokeninfo(aud="other-app-client-id")):
        response = APIClient().post(
            "/api/auth/google/",
            {"id_token": "fake-token"},
            format="json",
        )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "auth_google_failed"


@pytest.mark.django_db
def test_google_login_rejects_wrong_issuer(settings):
    settings.GOOGLE_CLIENT_ID = "web-client-id"

    payload = _google_tokeninfo()
    payload["iss"] = "https://evil.example.com"
    with _mock_get_ok(payload):
        response = APIClient().post(
            "/api/auth/google/",
            {"id_token": "fake-token"},
            format="json",
        )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "auth_google_failed"


@pytest.mark.django_db
def test_google_login_rejects_unverified_email(settings):
    settings.GOOGLE_CLIENT_ID = "web-client-id"

    with _mock_get_ok(_google_tokeninfo(verified=False)):
        response = APIClient().post(
            "/api/auth/google/",
            {"id_token": "fake-token"},
            format="json",
        )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "auth_google_failed"


@pytest.mark.django_db
def test_google_login_returns_400_when_not_configured(settings):
    settings.GOOGLE_CLIENT_ID = ""
    settings.GOOGLE_ANDROID_CLIENT_ID = ""

    response = APIClient().post(
        "/api/auth/google/",
        {"id_token": "fake-token"},
        format="json",
    )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "auth_google_failed"


@pytest.mark.django_db
def test_google_login_returns_400_when_id_token_missing(settings):
    settings.GOOGLE_CLIENT_ID = "web-client-id"

    response = APIClient().post("/api/auth/google/", {}, format="json")

    assert response.status_code == 400


@pytest.mark.django_db
def test_google_login_returns_400_when_tokeninfo_request_fails(settings):
    settings.GOOGLE_CLIENT_ID = "web-client-id"

    mock_resp = MagicMock()
    mock_resp.raise_for_status.side_effect = Exception("network error")

    with patch("splex.accounts.services.http_requests.get", return_value=mock_resp):
        response = APIClient().post(
            "/api/auth/google/",
            {"id_token": "bad-token"},
            format="json",
        )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "auth_google_failed"


# ---------------------------------------------------------------------------
# GET /api/login/config/
# ---------------------------------------------------------------------------


def test_login_config_returns_google_client_id(settings):
    settings.GOOGLE_CLIENT_ID = "web-client-id"
    settings.GOOGLE_ANDROID_CLIENT_ID = ""

    response = APIClient().get("/api/login/config/")

    assert response.status_code == 200
    assert response.data["google"]["client_id"] == "web-client-id"
    assert response.data["google"]["android_client_id"] is None


def test_login_config_returns_null_when_not_configured(settings):
    settings.GOOGLE_CLIENT_ID = ""
    settings.GOOGLE_ANDROID_CLIENT_ID = ""

    response = APIClient().get("/api/login/config/")

    assert response.status_code == 200
    assert response.data["google"]["client_id"] is None
    assert response.data["google"]["android_client_id"] is None


def test_login_config_requires_no_authentication():
    """The endpoint must be publicly accessible - unauthenticated callers need it."""
    response = APIClient().get("/api/login/config/")
    assert response.status_code == 200


def test_login_config_reports_demo_mode_enabled(settings):
    settings.DEMO_MODE_ENABLED = True
    response = APIClient().get("/api/login/config/")
    assert response.status_code == 200
    assert response.data["demo_mode_enabled"] is True


def test_login_config_reports_demo_mode_disabled_by_default(settings):
    settings.DEMO_MODE_ENABLED = False
    response = APIClient().get("/api/login/config/")
    assert response.status_code == 200
    assert response.data["demo_mode_enabled"] is False


# ---------------------------------------------------------------------------
# ALLOW_REGISTRATION gate (Google login path)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_google_login_rejects_new_user_when_registration_disabled(settings):
    settings.GOOGLE_CLIENT_ID = "web-client-id"
    settings.ALLOW_REGISTRATION = False

    with _mock_get_ok(_google_tokeninfo(email="newcomer@example.com")):
        response = APIClient().post(
            "/api/auth/google/",
            {"id_token": "fake-token"},
            format="json",
        )

    assert response.status_code == 400
    assert response.data["error"]["code"] == "auth_registration_disabled"

    user_model = get_user_model()
    assert not user_model.objects.filter(email="newcomer@example.com").exists()


@pytest.mark.django_db
def test_google_login_allows_existing_user_when_registration_disabled(settings):
    settings.GOOGLE_CLIENT_ID = "web-client-id"
    settings.ALLOW_REGISTRATION = False

    user_model = get_user_model()
    user_model.objects.create_user(email="existing@example.com", display_name="Existing")

    with _mock_get_ok(_google_tokeninfo(email="existing@example.com")):
        response = APIClient().post(
            "/api/auth/google/",
            {"id_token": "fake-token"},
            format="json",
        )

    assert response.status_code == 200
    assert response.data["tokens"]["created"] is False

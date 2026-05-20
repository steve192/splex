import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_me_returns_locale():
    User = get_user_model()
    user = User.objects.create_user(email="u@example.com", display_name="U", locale="de")
    response = _auth_client(user).get("/api/me/")
    assert response.status_code == 200
    assert response.data["locale"] == "de"


@pytest.mark.django_db
def test_me_patch_updates_locale():
    User = get_user_model()
    user = User.objects.create_user(email="u@example.com", display_name="U")
    response = _auth_client(user).patch("/api/me/", {"locale": "de"}, format="json")
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.locale == "de"


@pytest.mark.django_db
def test_me_patch_normalizes_default_currency_to_uppercase():
    User = get_user_model()
    user = User.objects.create_user(email="u@example.com", display_name="U")
    response = _auth_client(user).patch("/api/me/", {"default_currency": "usd"}, format="json")
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.default_currency == "USD"


@pytest.mark.django_db
def test_me_patch_no_longer_syncs_to_participant_display_name():
    """The denormalized sync was removed; participant.display_name stays whatever it was.
    The participant.effective_display_name property derives the live name from the user."""
    User = get_user_model()
    user = User.objects.create_user(email="u@example.com", display_name="Old")
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
    User = get_user_model()
    user = User.objects.create_user(email="u@example.com", display_name="U", push_enabled=True)
    _auth_client(user).patch("/api/me/", {"push_enabled": False}, format="json")
    user.refresh_from_db()
    assert user.push_enabled is False

import re

import pytest
from django.contrib.auth import get_user_model
from django.core import mail

from splex.accounts.models import MagicLoginChallenge
from splex.accounts.services import (
    authenticate_magic_code,
    authenticate_magic_token,
    request_magic_login,
)


def _extract_code(message: str) -> str:
    return re.search(r"\b(\d{6})\b", message).group(1)


@pytest.mark.django_db
def test_magic_code_requires_matching_email_and_consumes_link():
    request_magic_login("alice@example.com")
    message = mail.outbox[-1].body
    code = _extract_code(message)
    token = re.search(r"token=([^&\s]+)", message).group(1)

    with pytest.raises(ValueError):
        authenticate_magic_code("bob@example.com", code)

    authenticate_magic_code("alice@example.com", code)

    with pytest.raises(ValueError):
        authenticate_magic_token(token)


@pytest.mark.django_db
def test_magic_token_consumes_code_from_same_challenge():
    request_magic_login("alice@example.com")
    message = mail.outbox[-1].body
    code = _extract_code(message)
    token = re.search(r"token=([^&\s]+)", message).group(1)

    authenticate_magic_token(token)

    with pytest.raises(ValueError):
        authenticate_magic_code("alice@example.com", code)


@pytest.mark.django_db
def test_requesting_new_magic_login_invalidates_previous_pair():
    request_magic_login("alice@example.com")
    first_message = mail.outbox[-1].body
    first_code = _extract_code(first_message)
    first_token = re.search(r"token=([^&\s]+)", first_message).group(1)

    request_magic_login("alice@example.com")
    second_message = mail.outbox[-1].body
    second_code = _extract_code(second_message)

    with pytest.raises(ValueError):
        authenticate_magic_code("alice@example.com", first_code)
    with pytest.raises(ValueError):
        authenticate_magic_token(first_token)

    authenticate_magic_code("alice@example.com", second_code)
    assert MagicLoginChallenge.objects.filter(email="alice@example.com", consumed_at__isnull=True).count() == 0


@pytest.mark.django_db
def test_magic_code_rejects_new_user_when_registration_disabled(settings):
    settings.ALLOW_REGISTRATION = False
    request_magic_login("newcomer@example.com")
    code = _extract_code(mail.outbox[-1].body)

    with pytest.raises(ValueError, match="Registration is disabled"):
        authenticate_magic_code("newcomer@example.com", code)

    assert not get_user_model().objects.filter(email="newcomer@example.com").exists()


@pytest.mark.django_db
def test_magic_code_allows_existing_user_when_registration_disabled(settings):
    settings.ALLOW_REGISTRATION = False
    get_user_model().objects.create_user(email="existing@example.com", display_name="Existing")
    request_magic_login("existing@example.com")
    code = _extract_code(mail.outbox[-1].body)

    user, tokens = authenticate_magic_code("existing@example.com", code)
    assert user.email == "existing@example.com"
    assert tokens["created"] is False


@pytest.mark.django_db
def test_magic_token_rejects_new_user_when_registration_disabled(settings):
    settings.ALLOW_REGISTRATION = False
    request_magic_login("newcomer@example.com")
    token = re.search(r"token=([^&\s]+)", mail.outbox[-1].body).group(1)

    with pytest.raises(ValueError, match="Registration is disabled"):
        authenticate_magic_token(token)


@pytest.mark.django_db
def test_magic_link_email_uses_requested_locale_for_new_user():
    request_magic_login("alice@example.com", locale="de")

    message = mail.outbox[-1]
    assert message.subject == "Bei Splex anmelden"
    assert "Nutze diesen Link oder den Code unten" in message.body

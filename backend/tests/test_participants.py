import pytest
from django.contrib.auth import get_user_model

from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant


@pytest.mark.django_db
def test_effective_display_name_registered_uses_user_name():
    User = get_user_model()
    user = User.objects.create_user(email="alice@example.com", display_name="Alice A.")
    participant = get_or_create_user_participant(user)
    # Even if the stored display_name is stale, the user's is the source of truth.
    Participant.objects.filter(id=participant.id).update(display_name="stale")
    participant.refresh_from_db()
    assert participant.effective_display_name == "Alice A."


@pytest.mark.django_db
def test_effective_display_name_registered_falls_back_to_email_prefix():
    User = get_user_model()
    user = User.objects.create_user(email="bob@example.com", display_name="")
    participant = get_or_create_user_participant(user)
    assert participant.effective_display_name == "bob"


@pytest.mark.django_db
def test_effective_display_name_unregistered_uses_stored_name():
    participant = Participant.objects.create(
        display_name="Placeholder Pam", kind=Participant.Kind.UNREGISTERED
    )
    assert participant.effective_display_name == "Placeholder Pam"


@pytest.mark.django_db
def test_user_rename_reflects_immediately_without_sync():
    User = get_user_model()
    user = User.objects.create_user(email="carl@example.com", display_name="Carl")
    participant = get_or_create_user_participant(user)
    assert participant.effective_display_name == "Carl"

    user.display_name = "Carlos"
    user.save(update_fields=["display_name"])
    # No explicit sync; the property derives from the live user.
    participant.refresh_from_db()
    assert participant.effective_display_name == "Carlos"


@pytest.mark.django_db
def test_get_or_create_returns_existing_participant():
    User = get_user_model()
    user = User.objects.create_user(email="dave@example.com", display_name="Dave")
    first = get_or_create_user_participant(user)
    second = get_or_create_user_participant(user)
    assert first.id == second.id

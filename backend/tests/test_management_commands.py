from datetime import timedelta
from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone

from splex.accounts.models import MagicLoginChallenge
from splex.invitations.services import create_friend_invitation


def _run(command, **kwargs):
    out = StringIO()
    call_command(command, stdout=out, **kwargs)
    return out.getvalue()


# --- cleanup_links ------------------------------------------------------------


@pytest.mark.django_db
def test_cleanup_links_deletes_expired_and_keeps_fresh():
    now = timezone.now()
    MagicLoginChallenge.objects.create(
        email="old@example.com",
        code_hash="x",
        token_hash="old-token",
        expires_at=now - timedelta(days=10),
    )
    fresh = MagicLoginChallenge.objects.create(
        email="fresh@example.com",
        code_hash="y",
        token_hash="fresh-token",
        expires_at=now + timedelta(hours=1),
    )

    owner = get_user_model().objects.create_user(email="owner@example.com")
    invitation, _token, _url = create_friend_invitation(actor=owner)
    invitation.expires_at = now - timedelta(days=30)
    invitation.save(update_fields=["expires_at"])

    output = _run("cleanup_links")

    assert MagicLoginChallenge.objects.filter(id=fresh.id).exists()
    assert not MagicLoginChallenge.objects.filter(token_hash="old-token").exists()
    assert "Deleted 1 magic login records and 1 invitation records." in output


@pytest.mark.django_db
def test_cleanup_links_respects_older_than_days_argument():
    now = timezone.now()
    MagicLoginChallenge.objects.create(
        email="recent@example.com",
        code_hash="x",
        token_hash="recent-token",
        expires_at=now - timedelta(days=3),
    )
    # With a 7-day window a 3-day-old expiry is still retained.
    _run("cleanup_links", older_than_days=7)
    assert MagicLoginChallenge.objects.filter(token_hash="recent-token").exists()
    # With a 1-day window it is now eligible for deletion.
    _run("cleanup_links", older_than_days=1)
    assert not MagicLoginChallenge.objects.filter(token_hash="recent-token").exists()


# --- check_expo_receipts ------------------------------------------------------


@pytest.mark.django_db
def test_check_expo_receipts_reports_zero_when_no_tickets():
    output = _run("check_expo_receipts")
    assert "Checked 0 Expo receipt(s), deleted 0 dead token(s)." in output


# --- enforce_data_retention ---------------------------------------------------


@pytest.mark.django_db
@override_settings(DATA_RETENTION_INACTIVE_MONTHS=0)
def test_data_retention_disabled_does_nothing():
    user = get_user_model().objects.create_user(email="a@example.com")
    output = _run("enforce_data_retention")
    assert "disabled" in output.lower()
    assert get_user_model().objects.filter(id=user.id).exists()


def _set_last_active(user, days_ago):
    joined = timezone.now() - timedelta(days=days_ago)
    get_user_model().objects.filter(id=user.id).update(date_joined=joined, last_login=None)


@pytest.mark.django_db
@override_settings(DATA_RETENTION_INACTIVE_MONTHS=6)
def test_data_retention_dry_run_makes_no_changes():
    User = get_user_model()
    doomed = User.objects.create_user(email="doomed@example.com")
    _set_last_active(doomed, 200)  # past the 180-day deletion cutoff

    output = _run("enforce_data_retention", dry_run=True)

    assert "DRY RUN" in output
    assert "Would delete" in output
    # Nothing actually deleted, no email sent.
    assert User.objects.filter(id=doomed.id).exists()
    assert len(mail.outbox) == 0


@pytest.mark.django_db
@override_settings(DATA_RETENTION_INACTIVE_MONTHS=6)
def test_data_retention_sends_first_notice_and_sets_flag():
    User = get_user_model()
    warned = User.objects.create_user(email="warn@example.com", display_name="Warn")
    # 170 days inactive: past the 14-day warning cutoff (166d) but before the
    # 180-day deletion cutoff.
    _set_last_active(warned, 170)

    output = _run("enforce_data_retention")

    warned.refresh_from_db()
    assert warned.retention_first_notice_sent_at is not None
    assert len(mail.outbox) == 1
    assert "first notices: 1" in output
    # Still present (not yet past deletion).
    assert User.objects.filter(id=warned.id).exists()


@pytest.mark.django_db
@override_settings(DATA_RETENTION_INACTIVE_MONTHS=6)
def test_data_retention_deletes_long_inactive_account_and_keeps_active_one():
    User = get_user_model()
    doomed = User.objects.create_user(email="doomed@example.com")
    _set_last_active(doomed, 200)
    active = User.objects.create_user(email="active@example.com")
    _set_last_active(active, 3)

    output = _run("enforce_data_retention")

    assert not User.objects.filter(id=doomed.id).exists()
    assert User.objects.filter(id=active.id).exists()
    assert "deleted accounts: 1" in output

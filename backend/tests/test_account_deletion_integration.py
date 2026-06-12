"""Integration test: deleting a "fully equipped" account.

Builds a user that touches every kind of reference the deletion path has to
reconcile — invitations (sent and accepted), a friendship, a solo group with an
outstanding balance, a shared group, expenses, activity events, receipt
attachments, push credentials and a profile picture — then deletes the account
through the real API and asserts the whole graph is reconciled correctly:

  * PROTECT links (Invitation.invited_by / accepted_by) are removed up front so
    the User row can actually be deleted.
  * The solo group is soft-deleted even though it has an outstanding balance
    (last member abandons it; no settle-up is forced).
  * The shared group survives with the user swapped for an unregistered
    placeholder, preserving expenses/balances.
  * SET_NULL history (expenses, receipts, activity) survives with the user link
    severed.
  * The user's uploaded profile picture is physically removed from storage,
    while a receipt blob in a surviving group is kept (uploader link nulled).
  * Push credentials are wiped.
"""

import base64
from decimal import Decimal
from io import BytesIO
from tempfile import TemporaryDirectory

import pytest
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.db.models import Q
from django.test import override_settings
from PIL import Image
from rest_framework.test import APIClient

from splex.activity.models import ActivityEvent
from splex.expenses.models import Expense, ExpenseOwedShare
from splex.expenses.receipts import upload_receipt
from splex.expenses.services import create_expense
from splex.friends.models import Friendship
from splex.friends.services import create_friendship
from splex.groups.services import add_unregistered_participant, create_group
from splex.invitations.models import Invitation
from splex.invitations.services import (
    accept_invitation,
    create_friend_invitation,
    create_group_invitation,
)
from splex.notifications.models import DeviceToken, WebPushSubscription
from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant

# Minimal valid PNG: magic header + filler.  The receipt upload path only sniffs
# the header to determine the content type, so the magic bytes have to be real.
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _png_data_url() -> str:
    """A genuine PNG as a data URL - the avatar upload path decodes and re-encodes
    it with Pillow, so it must be a real image, not just valid magic bytes."""
    buffer = BytesIO()
    Image.new("RGB", (8, 8), (200, 30, 30)).save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{encoded}"


def _upload_png_receipt(*, actor, expense, name):
    return upload_receipt(
        actor=actor,
        file_obj=BytesIO(PNG_BYTES),
        original_filename=name,
        declared_content_type="image/png",
        size_bytes=len(PNG_BYTES),
        expense=expense,
    )


@pytest.fixture
def media_root():
    """Point storage at a throwaway directory so we can assert on real files."""
    with TemporaryDirectory() as tmp:
        with override_settings(MEDIA_ROOT=tmp):
            yield tmp


@pytest.mark.django_db
def test_delete_fully_equipped_account_reconciles_every_reference(media_root):
    user_model = get_user_model()

    # The account under test, plus two counterparties.
    user = user_model.objects.create_user(email="me@example.com", display_name="Mary")
    friend_user = user_model.objects.create_user(
        email="friend@example.com", display_name="Fred"
    )
    inviter = user_model.objects.create_user(
        email="inviter@example.com", display_name="Ivan"
    )

    user_participant = get_or_create_user_participant(user)

    # ── A real, uploaded profile picture ─────────────────────────────────────
    # Goes through the same data-URL upload path as the app: Pillow normalises
    # the image and stores it under profile-images/<uuid>.png in MEDIA_ROOT.
    patch = _auth_client(user).patch(
        "/api/me/", {"avatar_image": _png_data_url()}, format="json"
    )
    assert patch.status_code == 200
    user.refresh_from_db()
    avatar_path = user.avatar_url
    assert avatar_path.startswith("profile-images/")
    assert default_storage.exists(avatar_path)

    # ── Solo group with an OUTSTANDING balance against a placeholder ──────────
    # User is the only registered member, so deletion must soft-delete it - and
    # must NOT demand a settle-up first (regression guard for require_settled).
    solo_group = create_group(actor=user, name="Solo Trip", default_currency="EUR")
    ghost = add_unregistered_participant(
        actor=user, group=solo_group, display_name="Ghost"
    )
    solo_participant_id = solo_group.memberships.get(
        participant__user=user
    ).participant_id
    create_expense(
        actor=user,
        group=solo_group,
        data={
            "description": "Hotel",
            "amount": "100.00",
            "currency": "EUR",
            "split_method": "exact",
            "split_payload": {
                "shares": [
                    {"participant_id": solo_participant_id, "amount": "50.00"},
                    {"participant_id": ghost.id, "amount": "50.00"},
                ]
            },
        },
    )

    # ── Shared group joined by accepting another user's invitation ───────────
    # Gives us an Invitation with accepted_by=user (PROTECT) and a group where
    # the user must become a placeholder rather than be deleted.
    shared_group = create_group(actor=inviter, name="Shared Trip", default_currency="EUR")
    _, group_token, _ = create_group_invitation(actor=inviter, group=shared_group)
    accepted_invite = accept_invitation(actor=user, token=group_token)
    assert accepted_invite.accepted_by_id == user.id

    shared_expense = create_expense(
        actor=user,
        group=shared_group,
        data={
            "description": "Dinner",
            "amount": "40.00",
            "currency": "EUR",
            "split_method": "equal_all",
        },
    )

    # ── An invitation the user SENT (invited_by=user, PROTECT) ───────────────
    sent_invite, _, _ = create_friend_invitation(actor=user)
    assert sent_invite.invited_by_id == user.id

    # ── A friendship with a friend-context expense ───────────────────────────
    friend_participant = get_or_create_user_participant(friend_user)
    friendship = create_friendship(user, friend_participant)
    friend_expense = create_expense(
        actor=user,
        friendship=friendship,
        data={
            "description": "Coffee",
            "amount": "6.00",
            "currency": "EUR",
            "split_method": "equal_all",
        },
    )

    # ── A real receipt uploaded by the user into the SURVIVING shared group ──
    # Its blob must be kept (the group lives on) but the uploader link nulled.
    receipt = _upload_png_receipt(actor=user, expense=shared_expense, name="dinner.png")
    receipt_path = receipt.storage_path
    assert default_storage.exists(receipt_path)

    # ── Push credentials ─────────────────────────────────────────────────────
    DeviceToken.objects.create(user=user, platform="android", token="dev-tok")
    WebPushSubscription.objects.create(
        user=user, endpoint="https://push/me", p256dh="pk", auth="auth"
    )

    # Snapshot ids/state we need to assert against after the user row is gone.
    user_id = user.id
    sent_invite_id = sent_invite.id
    accepted_invite_id = accepted_invite.id
    friend_expense_id = friend_expense.id
    activity_ids_by_user = list(
        ActivityEvent.objects.filter(actor=user).values_list("id", flat=True)
    )
    assert activity_ids_by_user, "fixture should have produced activity for the user"

    # Sanity: the solo group really does carry an outstanding balance, so the
    # require_settled=False path is genuinely exercised.
    from splex.balances.selectors import group_has_outstanding_balance

    assert group_has_outstanding_balance(solo_group) is True

    # ── Act ──────────────────────────────────────────────────────────────────
    response = _auth_client(user).delete("/api/me/delete/")
    assert response.status_code == 204

    # ── User row and its PROTECT links are gone ──────────────────────────────
    assert not user_model.objects.filter(id=user_id).exists()
    assert not Invitation.objects.filter(id=sent_invite_id).exists()
    assert not Invitation.objects.filter(id=accepted_invite_id).exists()
    assert not Invitation.objects.filter(
        Q(invited_by_id=user_id) | Q(accepted_by_id=user_id)
    ).exists()

    # ── Solo group soft-deleted despite the outstanding balance ──────────────
    solo_group.refresh_from_db()
    assert solo_group.deleted_at is not None

    # ── Shared group survives; user replaced by an unregistered placeholder ──
    # The membership is transferred to a NEW unregistered participant (the
    # original user_participant keeps the friend-context history).
    shared_group.refresh_from_db()
    assert shared_group.deleted_at is None
    inviter_participant_id = get_or_create_user_participant(inviter).id
    placeholder = (
        Participant.objects.filter(
            kind=Participant.Kind.UNREGISTERED,
            group_memberships__group=shared_group,
            group_memberships__removed_at__isnull=True,
        )
        .exclude(id=inviter_participant_id)
        .first()
    )
    assert placeholder is not None
    assert placeholder.user_id is None
    assert placeholder.display_name == "Mary"

    # The original participant survives (friend-context data) but is detached.
    user_participant.refresh_from_db()
    assert user_participant.user_id is None
    assert user_participant.kind == Participant.Kind.UNREGISTERED

    # ── SET_NULL history survives with the user link severed ─────────────────
    friend_expense = Expense.objects.get(id=friend_expense_id)
    assert friend_expense.created_by_id is None
    receipt.refresh_from_db()
    assert receipt.uploaded_by_id is None
    surviving_activity = ActivityEvent.objects.filter(id__in=activity_ids_by_user)
    assert surviving_activity.count() == len(activity_ids_by_user)
    assert not surviving_activity.exclude(actor__isnull=True).exists()

    # ── Storage blobs: avatar removed, surviving-group receipt kept ──────────
    assert not default_storage.exists(avatar_path)
    assert default_storage.exists(receipt_path)

    # ── Friendship preserved ─────────────────────────────────────────────────
    assert Friendship.objects.filter(id=friendship.id).exists()

    # ── Push credentials wiped ───────────────────────────────────────────────
    assert not DeviceToken.objects.filter(token="dev-tok").exists()
    assert not WebPushSubscription.objects.filter(endpoint="https://push/me").exists()


@pytest.mark.django_db
def test_delete_account_as_last_registered_member_soft_deletes_group():
    """The deleting user is the only registered member: the group is soft-deleted
    (and balances against unregistered placeholders do not block it)."""
    user_model = get_user_model()
    user = user_model.objects.create_user(email="last@example.com", display_name="Last")
    group = create_group(actor=user, name="Solo Trip", default_currency="EUR")
    ghost = add_unregistered_participant(actor=user, group=group, display_name="Ghost")
    user_participant_id = group.memberships.get(participant__user=user).participant_id
    # An outstanding balance against the placeholder must not force a settle-up.
    create_expense(
        actor=user,
        group=group,
        data={
            "description": "Hotel",
            "amount": "80.00",
            "currency": "EUR",
            "split_method": "exact",
            "split_payload": {
                "shares": [
                    {"participant_id": user_participant_id, "amount": "40.00"},
                    {"participant_id": ghost.id, "amount": "40.00"},
                ]
            },
        },
    )

    response = _auth_client(user).delete("/api/me/delete/")
    assert response.status_code == 204

    assert not user_model.objects.filter(email="last@example.com").exists()
    group.refresh_from_db()
    assert group.deleted_at is not None


@pytest.mark.django_db
def test_delete_account_with_other_registered_member_converts_to_placeholder():
    """Another registered member remains, so the deleting user is converted to an
    unregistered placeholder; the group survives and its ledger is preserved."""
    user_model = get_user_model()
    leaver = user_model.objects.create_user(email="leaver@example.com", display_name="Leaver")
    stayer = user_model.objects.create_user(email="stayer@example.com", display_name="Stayer")

    group = create_group(actor=leaver, name="Shared Trip", default_currency="EUR")
    _, group_token, _ = create_group_invitation(actor=leaver, group=group)
    accept_invitation(actor=stayer, token=group_token)
    stayer_participant = get_or_create_user_participant(stayer)

    leaver_participant = get_or_create_user_participant(leaver)
    expense = create_expense(
        actor=leaver,
        group=group,
        data={
            "description": "Dinner",
            "amount": "30.00",
            "currency": "EUR",
            "split_method": "equal_all",
        },
    )

    response = _auth_client(leaver).delete("/api/me/delete/")
    assert response.status_code == 204

    assert not user_model.objects.filter(email="leaver@example.com").exists()
    group.refresh_from_db()
    assert group.deleted_at is None  # group survives

    # A new unregistered placeholder took the leaver's place as an active member.
    placeholder = (
        Participant.objects.filter(
            kind=Participant.Kind.UNREGISTERED,
            group_memberships__group=group,
            group_memberships__removed_at__isnull=True,
        )
        .exclude(id=stayer_participant.id)
        .first()
    )
    assert placeholder is not None
    assert placeholder.display_name == "Leaver"

    # The ledger is preserved: the expense and its shares moved to the placeholder.
    assert Expense.objects.filter(id=expense.id).exists()
    assert not ExpenseOwedShare.objects.filter(participant=leaver_participant).exists()
    assert ExpenseOwedShare.objects.filter(
        expense=expense, participant=placeholder
    ).exists()

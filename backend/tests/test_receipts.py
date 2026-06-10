"""End-to-end tests for the receipt upload feature."""

from io import BytesIO
from tempfile import TemporaryDirectory

import pytest
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APIClient

from splex.expenses.models import Receipt
from splex.expenses.receipts import upload_receipt
from splex.expenses.services import create_expense
from splex.groups.services import add_unregistered_participant, create_group, delete_group

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100  # minimal magic header + filler
PDF_BYTES = b"%PDF-1.4\n" + b"\x00" * 100
RANDOM_BYTES = b"not a valid file" * 10


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _upload(client, *, group_id=None, friendship_id=None, expense_id=None,
            client_id="", content=PDF_BYTES, content_type="application/pdf",
            name="receipt.pdf"):
    fields = {"file": SimpleUploadedFile(name, content, content_type=content_type)}
    if group_id:
        fields["group_id"] = str(group_id)
    if friendship_id:
        fields["friendship_id"] = str(friendship_id)
    if expense_id:
        fields["expense_id"] = str(expense_id)
    if client_id:
        fields["client_id"] = client_id
    return client.post("/api/receipts/", fields, format="multipart")


@pytest.fixture
def alice():
    return get_user_model().objects.create_user(email="a@x.com", display_name="A")


@pytest.fixture
def group(alice):
    return create_group(actor=alice, name="Trip", default_currency="EUR")


@pytest.fixture
def media_root():
    with TemporaryDirectory() as tmp:
        with override_settings(MEDIA_ROOT=tmp):
            yield tmp


@pytest.mark.django_db
def test_upload_pdf_creates_receipt_in_storage(alice, group, media_root):
    response = _upload(_auth_client(alice), group_id=group.id, client_id="abc123")
    assert response.status_code == 201, response.content
    body = response.json()
    assert body["content_type"] == "application/pdf"
    assert body["size_bytes"] > 0
    receipt = Receipt.objects.get(pk=body["id"])
    assert default_storage.exists(receipt.storage_path)
    assert receipt.expense_id is None  # still a draft
    assert receipt.client_id == "abc123"


@pytest.mark.django_db
def test_upload_rejects_unknown_file_type(alice, group, media_root):
    response = _upload(
        _auth_client(alice),
        group_id=group.id,
        content=RANDOM_BYTES,
        content_type="application/octet-stream",
        name="virus.exe",
    )
    assert response.status_code == 400
    detail = response.json()["detail"].lower()
    assert "unsupported" in detail or "not recognized" in detail


@pytest.mark.django_db
def test_upload_rejects_oversized_file(alice, group, media_root):
    big = PDF_BYTES + b"\x00" * 200
    with override_settings(RECEIPT_MAX_FILE_SIZE_BYTES=128):
        response = _upload(_auth_client(alice), group_id=group.id, content=big)
    assert response.status_code == 400
    assert "too large" in response.json()["detail"].lower()


@pytest.mark.django_db
def test_per_group_quota_enforced(alice, group, media_root):
    with override_settings(RECEIPT_MAX_GROUP_TOTAL_BYTES=200):
        r1 = _upload(_auth_client(alice), group_id=group.id, content=PDF_BYTES + b"\x00" * 80)
        assert r1.status_code == 201
        r2 = _upload(_auth_client(alice), group_id=group.id, content=PDF_BYTES + b"\x00" * 200)
        assert r2.status_code == 400
        assert "quota" in r2.json()["detail"].lower()


@pytest.mark.django_db
def test_can_attach_receipt_to_existing_expense(alice, group, media_root):
    """Editing an expense later and attaching a new receipt must succeed."""
    add_unregistered_participant(actor=alice, group=group, display_name="Bob")
    expense = create_expense(
        actor=alice,
        group=group,
        data={
            "description": "Lunch",
            "amount": "20.00",
            "currency": "EUR",
            "split_method": "equal_all",
        },
    )
    # Now attach a receipt later, using only expense_id (no client_id needed).
    response = _upload(_auth_client(alice), expense_id=expense.id)
    assert response.status_code == 201
    receipt = Receipt.objects.get(pk=response.json()["id"])
    assert receipt.expense_id == expense.id
    assert receipt.group_id == group.id


@pytest.mark.django_db
def test_drafts_attach_when_expense_created(alice, group, media_root):
    add_unregistered_participant(actor=alice, group=group, display_name="Bob")
    cid = "cid-attach-test"
    r = _upload(_auth_client(alice), group_id=group.id, client_id=cid)
    receipt_id = r.json()["id"]
    expense = create_expense(
        actor=alice,
        group=group,
        data={
            "client_id": cid,
            "description": "Coffee",
            "amount": "4.50",
            "currency": "EUR",
            "split_method": "equal_all",
        },
    )
    Receipt.objects.get(pk=receipt_id, expense=expense)


@pytest.mark.django_db
def test_download_returns_file_with_inline_disposition(alice, group, media_root):
    r = _upload(_auth_client(alice), group_id=group.id, content=PNG_BYTES,
                content_type="image/png", name="slip.png")
    rid = r.json()["id"]
    response = _auth_client(alice).get(f"/api/receipts/{rid}/download/")
    assert response.status_code == 200
    assert response["Content-Type"] == "image/png"
    assert "inline" in response["Content-Disposition"]
    assert "slip.png" in response["Content-Disposition"]


@pytest.mark.django_db
def test_download_escapes_quotes_in_filename(alice, group, media_root):
    r = _upload(_auth_client(alice), group_id=group.id, content=PNG_BYTES,
                content_type="image/png", name='ev"il.png')
    rid = r.json()["id"]
    response = _auth_client(alice).get(f"/api/receipts/{rid}/download/")
    assert response.status_code == 200
    disposition = response["Content-Disposition"]
    # The bare double-quote must not survive unescaped into the header value,
    # otherwise a crafted filename could spoof the disposition parameters.
    assert 'filename="ev"il.png"' not in disposition
    assert "\n" not in disposition and "\r" not in disposition


@pytest.mark.django_db
def test_download_requires_authentication(alice, group, media_root):
    r = _upload(_auth_client(alice), group_id=group.id)
    rid = r.json()["id"]
    response = APIClient().get(f"/api/receipts/{rid}/download/")
    assert response.status_code == 401


@pytest.mark.django_db
def test_non_member_cannot_delete_receipt_with_null_uploader(alice, group, media_root):
    """Account-deletion clears uploaded_by; non-members still must not delete."""
    bob = get_user_model().objects.create_user(email="b@x.com", display_name="B")
    r = _upload(_auth_client(alice), group_id=group.id)
    rid = r.json()["id"]
    # Simulate the original uploader's account being deleted (SET_NULL on FK).
    Receipt.objects.filter(pk=rid).update(uploaded_by=None)
    response = _auth_client(bob).delete(f"/api/receipts/{rid}/")
    assert response.status_code == 403
    assert Receipt.objects.filter(pk=rid).exists()


@pytest.mark.django_db
def test_non_member_cannot_download(alice, group, media_root):
    bob = get_user_model().objects.create_user(email="b@x.com", display_name="B")
    r = _upload(_auth_client(alice), group_id=group.id)
    rid = r.json()["id"]
    response = _auth_client(bob).get(f"/api/receipts/{rid}/download/")
    assert response.status_code == 403


@pytest.mark.django_db
def test_delete_endpoint_removes_blob(alice, group, media_root):
    r = _upload(_auth_client(alice), group_id=group.id)
    receipt = Receipt.objects.get(pk=r.json()["id"])
    path = receipt.storage_path
    assert default_storage.exists(path)
    response = _auth_client(alice).delete(f"/api/receipts/{receipt.id}/")
    assert response.status_code == 204
    assert not Receipt.objects.filter(pk=receipt.id).exists()
    assert not default_storage.exists(path)


@pytest.mark.django_db
def test_group_deletion_purges_receipts(alice, group, media_root):
    r = _upload(_auth_client(alice), group_id=group.id)
    receipt = Receipt.objects.get(pk=r.json()["id"])
    path = receipt.storage_path
    delete_group(actor=alice, group=group)
    assert not Receipt.objects.filter(pk=receipt.id).exists()
    assert not default_storage.exists(path)


@pytest.mark.django_db
def test_cleanup_receipts_removes_expired_drafts(alice, group, media_root):
    from datetime import timedelta

    from django.core.management import call_command
    from django.utils import timezone

    r = _upload(_auth_client(alice), group_id=group.id, client_id="orphan")
    draft = Receipt.objects.get(pk=r.json()["id"])
    path = draft.storage_path
    # Backdate the row to past the retention window.
    Receipt.objects.filter(pk=draft.id).update(
        created_at=timezone.now() - timedelta(hours=48)
    )
    with override_settings(RECEIPT_DRAFT_RETENTION_HOURS=24):
        call_command("cleanup_receipts")
    assert not Receipt.objects.filter(pk=draft.id).exists()
    assert not default_storage.exists(path)


@pytest.mark.django_db
def test_zero_disables_per_file_limit(alice, group, media_root):
    """Setting RECEIPT_MAX_FILE_SIZE_BYTES=0 means no upper bound."""
    huge = PDF_BYTES + b"\x00" * 5_000_000
    with override_settings(RECEIPT_MAX_FILE_SIZE_BYTES=0):
        response = _upload(_auth_client(alice), group_id=group.id, content=huge)
    assert response.status_code == 201


@pytest.mark.django_db
def test_zero_disables_per_group_quota(alice, group, media_root):
    """Setting RECEIPT_MAX_GROUP_TOTAL_BYTES=0 means unlimited group storage."""
    big = PDF_BYTES + b"\x00" * 2000
    with override_settings(RECEIPT_MAX_GROUP_TOTAL_BYTES=0):
        # Upload many large files without hitting the quota.
        for _ in range(3):
            response = _upload(_auth_client(alice), group_id=group.id, content=big)
            assert response.status_code == 201


@pytest.mark.django_db
def test_cleanup_disabled_when_retention_zero(alice, group, media_root):
    from django.core.management import call_command

    r = _upload(_auth_client(alice), group_id=group.id, client_id="orphan-zero")
    draft_id = r.json()["id"]
    with override_settings(RECEIPT_DRAFT_RETENTION_HOURS=0):
        call_command("cleanup_receipts")
    assert Receipt.objects.filter(pk=draft_id).exists()


@pytest.mark.django_db
def test_upload_service_rejects_declared_type_mismatch(alice, group, media_root):
    """Magic-byte sniffing wins over the client-declared content-type."""
    # Random bytes labeled as PDF - should still be rejected by the sniffer.
    with pytest.raises(Exception) as exc:
        upload_receipt(
            actor=alice,
            file_obj=BytesIO(RANDOM_BYTES),
            original_filename="evil.pdf",
            declared_content_type="application/pdf",
            size_bytes=len(RANDOM_BYTES),
            group=group,
            client_id="x",
        )
    assert "not recognized" in str(exc.value).lower()

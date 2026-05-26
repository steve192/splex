"""Receipt service module — upload, attach, list, delete and cleanup.

A receipt is a single image (JPEG/PNG/WebP) or PDF file that a user attaches
to an expense to back it up with documentary evidence.  Files are stored
under ``receipts/<group_or_friend>/<uuid>.<ext>`` in Django's default storage
and only retrievable through the authenticated ``/api/receipts/<id>/download/``
endpoint.

Upload lifecycle
----------------
1.  User taps "Add receipt" on the AddScreen before saving the expense.  The
    file is uploaded with the expense's pending ``client_id`` and the chosen
    context (group_id or friendship_id) — but no expense_id yet.  The Receipt
    row is created in "draft" state (expense_id NULL).
2.  When the expense is saved, ``attach_drafts_to_expense`` matches drafts by
    ``(uploaded_by, client_id)`` and points them at the freshly created
    expense.
3.  If the user navigates away without saving, the receipt stays as a draft
    and is cleaned up after ``RECEIPT_DRAFT_RETENTION_HOURS`` by
    ``cleanup_receipt_drafts``.

Files are physically removed from storage when:
  - the receipt is deleted via API
  - the parent group is soft-deleted (``delete_group``)
  - the parent expense is hard-deleted via CASCADE (rare; soft delete keeps them)
  - a draft is cleaned up
"""

import logging
import uuid
from pathlib import PurePosixPath
from typing import IO

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Sum

from splex.expenses.models import Expense, Receipt
from splex.friends.models import Friendship
from splex.groups.models import Group
from splex.groups.services import assert_group_member
from splex.expenses.services import ensure_context_access

logger = logging.getLogger(__name__)

# Map content-type → (file extension, magic-byte sniffer).
# Each sniffer returns True iff the bytes look like the declared format.
def _is_jpeg(head: bytes) -> bool:
    return head.startswith(b"\xff\xd8\xff")


def _is_png(head: bytes) -> bool:
    return head.startswith(b"\x89PNG\r\n\x1a\n")


def _is_webp(head: bytes) -> bool:
    return head[:4] == b"RIFF" and head[8:12] == b"WEBP"


def _is_pdf(head: bytes) -> bool:
    return head.startswith(b"%PDF-")


_ALLOWED_TYPES: dict[str, tuple[str, callable]] = {
    Receipt.ContentType.JPEG: ("jpg", _is_jpeg),
    Receipt.ContentType.PNG: ("png", _is_png),
    Receipt.ContentType.WEBP: ("webp", _is_webp),
    Receipt.ContentType.PDF: ("pdf", _is_pdf),
}

# Enough bytes for magic-byte sniffing across all supported types (WebP needs 12).
_MAGIC_PROBE_BYTES = 16


class ReceiptError(ValueError):
    """Validation error raised for bad/oversize/unsupported receipts."""


def _read_head(file_obj: IO[bytes]) -> bytes:
    head = file_obj.read(_MAGIC_PROBE_BYTES)
    try:
        file_obj.seek(0)
    except (AttributeError, OSError):
        pass
    return head


def _detect_content_type(file_obj: IO[bytes], declared: str | None) -> str:
    """Return the canonical content type after magic-byte sniffing.

    The declared (client-provided) content type is honored only if it appears
    in the allow list AND the file's magic bytes match it.  This prevents a
    client from labeling an executable as ``image/jpeg`` to bypass filtering.
    """
    head = _read_head(file_obj)
    for ct, (_ext, sniffer) in _ALLOWED_TYPES.items():
        if sniffer(head):
            return ct
    # Provide a clearer error if the user picked something obvious but unsupported.
    if declared and declared.lower() not in _ALLOWED_TYPES:
        raise ReceiptError(f"Unsupported file type: {declared}")
    raise ReceiptError("File type not recognized. Allowed: JPEG, PNG, WebP, PDF.")


def _context_storage_prefix(*, group: Group | None, friendship: Friendship | None) -> str:
    if group:
        return f"receipts/group-{group.id}"
    if friendship:
        return f"receipts/friend-{friendship.id}"
    raise ReceiptError("Receipt requires a group or friendship context.")


def _safe_filename(name: str) -> str:
    """Sanitize a user-supplied filename for safe display/serving.

    The on-disk storage path is always a UUID — this is just the value we
    echo back to the client and use in the Content-Disposition header.
    """
    name = (name or "").strip().replace("\x00", "")
    if not name:
        return "receipt"
    # Strip any directory components a client might have included.
    name = PurePosixPath(name).name or "receipt"
    # Common request: limit to a sane length for DB + HTTP headers.
    return name[:250]


def _enforce_group_quota(*, group: Group, new_file_size: int) -> None:
    """Raise ReceiptError if accepting ``new_file_size`` would exceed the quota."""
    quota = getattr(settings, "RECEIPT_MAX_GROUP_TOTAL_BYTES", 0)
    if quota <= 0:
        return
    used = (
        Receipt.objects.filter(group=group).aggregate(total=Sum("size_bytes"))["total"] or 0
    )
    if used + new_file_size > quota:
        remaining = max(0, quota - used)
        raise ReceiptError(
            f"Group receipt storage quota exceeded. "
            f"Limit: {quota} bytes, currently used: {used} bytes, "
            f"available: {remaining} bytes."
        )


@transaction.atomic
def upload_receipt(
    *,
    actor,
    file_obj: IO[bytes],
    original_filename: str,
    declared_content_type: str | None,
    size_bytes: int,
    group: Group | None = None,
    friendship: Friendship | None = None,
    client_id: str = "",
    expense: Expense | None = None,
) -> Receipt:
    """Validate a receipt upload and persist it to storage + DB.

    The caller is responsible for closing ``file_obj`` after this returns.
    """
    if not group and not friendship and not expense:
        raise ReceiptError("Receipt must be associated with a group, friendship or expense.")

    if expense and not (group or friendship):
        # Reuse the expense's context if the caller did not pass one explicitly.
        group = expense.group
        friendship = expense.friendship

    # Permission: the actor must be a member of the target context.
    ensure_context_access(actor, group, friendship)

    max_size = getattr(settings, "RECEIPT_MAX_FILE_SIZE_BYTES", 15 * 1024 * 1024)
    if size_bytes <= 0:
        raise ReceiptError("Empty file.")
    # max_size = 0 disables the per-file limit (unlimited).
    if max_size > 0 and size_bytes > max_size:
        raise ReceiptError(f"File is too large. Maximum size is {max_size} bytes.")

    # Group quota applies regardless of whether this upload is a draft.
    if group is not None:
        _enforce_group_quota(group=group, new_file_size=size_bytes)

    detected_type = _detect_content_type(file_obj, declared_content_type)
    extension, _sniffer = _ALLOWED_TYPES[detected_type]

    storage_dir = _context_storage_prefix(group=group, friendship=friendship)
    storage_name = f"{storage_dir}/{uuid.uuid4().hex}.{extension}"
    stored_path = default_storage.save(storage_name, ContentFile(file_obj.read()))

    return Receipt.objects.create(
        expense=expense,
        group=group,
        friendship=friendship,
        uploaded_by=actor,
        client_id=client_id or "",
        storage_path=stored_path,
        original_filename=_safe_filename(original_filename),
        content_type=detected_type,
        size_bytes=size_bytes,
    )


def attach_drafts_to_expense(*, actor, expense: Expense) -> int:
    """Attach any draft receipts uploaded by ``actor`` for the expense's client_id.

    Only drafts whose context matches the expense (same group_id / friendship_id)
    are attached — the upload endpoint already enforces context membership but
    we re-check here so a stray client_id collision cannot leak data across
    contexts.

    Returns the number of receipts attached.
    """
    if not expense.client_id:
        return 0
    drafts = Receipt.objects.filter(
        uploaded_by=actor,
        client_id=expense.client_id,
        expense__isnull=True,
        group=expense.group,
        friendship=expense.friendship,
    )
    return drafts.update(expense=expense)


def delete_receipt(*, actor, receipt: Receipt) -> None:
    """Delete a receipt.

    Group-context: any active group member may delete.
    Friendship-context: only the uploader may delete (no shared admin).
    Orphaned receipts (no context, shouldn't normally happen): uploader only.

    Note: ``uploaded_by_id`` may be NULL when the original uploader's account
    has been deleted (SET_NULL).  We must not let that short-circuit the
    membership check, otherwise any authenticated user could delete the
    receipt just by guessing its id.
    """
    if receipt.group_id is not None:
        assert_group_member(actor, receipt.group)
    elif receipt.uploaded_by_id != actor.id:
        # Friendship-context, or no context at all: uploader only.
        raise PermissionError("Only the uploader can delete this receipt.")
    _remove_storage_blob(receipt.storage_path)
    receipt.delete()


def delete_receipts_for_group(group: Group) -> int:
    """Hard-delete every receipt belonging to ``group`` plus its on-disk file.

    Returns the number of receipts removed.  Safe to call on a group that has
    no receipts.
    """
    count = 0
    for receipt in Receipt.objects.filter(group=group).iterator():
        _remove_storage_blob(receipt.storage_path)
        receipt.delete()
        count += 1
    if count:
        logger.info("Deleted %s receipt(s) for group_id=%s", count, group.id)
    return count


def _remove_storage_blob(path: str) -> None:
    if not path:
        return
    try:
        if default_storage.exists(path):
            default_storage.delete(path)
    except Exception:  # noqa: BLE001 - storage backend failures are recoverable
        logger.warning("Failed to delete receipt blob at %s", path, exc_info=True)


def list_receipts_for_expense(expense: Expense):
    return Receipt.objects.filter(expense=expense).order_by("id")


def serialize_receipt(receipt: Receipt) -> dict:
    return {
        "id": receipt.id,
        "expense_id": receipt.expense_id,
        "original_filename": receipt.original_filename,
        "content_type": receipt.content_type,
        "size_bytes": receipt.size_bytes,
        "created_at": receipt.created_at,
        "uploaded_by_id": receipt.uploaded_by_id,
    }

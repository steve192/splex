"""API endpoints for receipt upload, download and delete."""

import logging

from django.core.files.storage import default_storage
from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.expenses.models import Expense, Receipt
from splex.expenses.receipts import (
    ReceiptError,
    delete_receipt,
    serialize_receipt,
    upload_receipt,
)
from splex.friends.models import Friendship
from splex.groups.models import Group

logger = logging.getLogger(__name__)


class ReceiptUploadView(APIView):
    """``POST /api/receipts/`` - multipart upload of a new receipt.

    Required form fields:
      - ``file``: the binary file (image or PDF)

    One of the following context fields must be present:
      - ``expense_id``    - attach to an existing expense (must be accessible)
      - ``group_id`` + ``client_id``      - draft for a pending group expense
      - ``friendship_id`` + ``client_id`` - draft for a pending friendship expense
    """

    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file_obj = request.FILES.get("file")
        if file_obj is None:
            return Response({"detail": "file is required."}, status=status.HTTP_400_BAD_REQUEST)

        expense = self._resolve_expense(request)
        group, friendship = self._resolve_context(request, expense)
        client_id = (request.data.get("client_id") or "").strip()

        try:
            receipt = upload_receipt(
                actor=request.user,
                file_obj=file_obj,
                original_filename=getattr(file_obj, "name", "receipt") or "receipt",
                declared_content_type=getattr(file_obj, "content_type", None),
                size_bytes=getattr(file_obj, "size", None) or 0,
                group=group,
                friendship=friendship,
                client_id=client_id,
                expense=expense,
            )
        except ReceiptError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)

        return Response(serialize_receipt(receipt), status=status.HTTP_201_CREATED)

    def _resolve_expense(self, request) -> Expense | None:
        expense_id = request.data.get("expense_id")
        if not expense_id:
            return None
        try:
            return Expense.objects.get(id=expense_id, deleted_at__isnull=True)
        except Expense.DoesNotExist:
            raise Http404("Expense not found.")

    def _resolve_context(self, request, expense: Expense | None):
        if expense is not None:
            return expense.group, expense.friendship
        group_id = request.data.get("group_id")
        friendship_id = request.data.get("friendship_id")
        if group_id:
            try:
                return Group.objects.get(id=group_id, deleted_at__isnull=True), None
            except Group.DoesNotExist:
                raise Http404("Group not found.")
        if friendship_id:
            try:
                return None, Friendship.objects.get(id=friendship_id)
            except Friendship.DoesNotExist:
                raise Http404("Friendship not found.")
        return None, None


class ReceiptDetailView(APIView):
    """``DELETE /api/receipts/<id>/`` - remove a receipt and its file."""

    def delete(self, request, receipt_id):
        try:
            receipt = Receipt.objects.get(id=receipt_id)
        except Receipt.DoesNotExist:
            raise Http404("Receipt not found.")
        try:
            delete_receipt(actor=request.user, receipt=receipt)
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReceiptDownloadView(APIView):
    """``GET /api/receipts/<id>/download/`` - stream the file back to the user.

    The Content-Disposition header includes the original filename and, by
    default, the file is served inline so PDFs and images preview in the
    browser / open in the OS "open with" dialog on Android.
    """

    def get(self, request, receipt_id):
        try:
            receipt = Receipt.objects.select_related(
                "group", "friendship", "expense"
            ).get(id=receipt_id)
        except Receipt.DoesNotExist:
            raise Http404("Receipt not found.")
        # Permission: re-use the same access check as the expense detail screen.
        from splex.expenses.services import ensure_context_access

        try:
            ensure_context_access(request.user, receipt.group, receipt.friendship)
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)

        if not default_storage.exists(receipt.storage_path):
            logger.warning(
                "Receipt blob missing on disk (id=%s, path=%s)",
                receipt.id,
                receipt.storage_path,
            )
            raise Http404("Receipt file is no longer available.")
        # ``inline`` lets the browser preview the file and triggers Android's
        # "open with" intent for unknown viewers.  Let Django build the
        # Content-Disposition header so the (user-supplied) filename is escaped
        # per RFC 6266 - hand-formatting it allowed quote/charset injection.
        response = FileResponse(
            default_storage.open(receipt.storage_path, "rb"),
            content_type=receipt.content_type,
            as_attachment=False,
            filename=receipt.original_filename,
        )
        return response

"""cleanup_receipts - delete draft receipts that were never attached.

A "draft" receipt is one whose ``expense`` field is NULL: it was uploaded by
a user who started filling out the AddScreen but never saved the expense.
The cleanup window is set by ``RECEIPT_DRAFT_RETENTION_HOURS`` (default 24h).

Run automatically every 24 h by the background scheduler; safe to invoke
manually with ``--dry-run`` to preview.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from splex.expenses.models import Receipt
from splex.expenses.receipts import _remove_storage_blob

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Delete orphaned draft receipts older than RECEIPT_DRAFT_RETENTION_HOURS."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        hours = getattr(settings, "RECEIPT_DRAFT_RETENTION_HOURS", 24)
        if hours <= 0:
            self.stdout.write("Receipt draft cleanup disabled (RECEIPT_DRAFT_RETENTION_HOURS<=0).")
            return
        cutoff = timezone.now() - timedelta(hours=hours)
        drafts = Receipt.objects.filter(expense__isnull=True, created_at__lt=cutoff)
        dry_run = options["dry_run"]
        count = 0
        for draft in drafts.iterator():
            if dry_run:
                self.stdout.write(
                    f"  Would delete draft id={draft.id} "
                    "(uploaded_by="
                    f"{draft.uploaded_by_id}, "
                    f"created_at={draft.created_at:%Y-%m-%d %H:%M})"
                )
                count += 1
                continue
            _remove_storage_blob(draft.storage_path)
            draft.delete()
            count += 1
        prefix = "[DRY RUN] Would have deleted" if dry_run else "Deleted"
        self.stdout.write(self.style.SUCCESS(f"{prefix} {count} draft receipt(s)."))

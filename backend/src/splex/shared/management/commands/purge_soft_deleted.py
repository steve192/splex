"""purge_soft_deleted - permanently remove records that have been soft-deleted
longer than the data-retention window.

Most of Splex's domain records are *soft* deleted: groups (``deleted_at``),
friendships (``ended_at``), expenses/settlements (``deleted_at``) and group
memberships (``removed_at``) stay in the database so history, balances and the
activity log keep resolving.  Nothing ever removed them for good - this command
does, once they are older than ``DATA_RETENTION_INACTIVE_MONTHS`` (the same
window that governs inactive-account deletion).  Set it to 0 to disable.

    python manage.py purge_soft_deleted --dry-run

Run automatically every ~24h by the background scheduler (splex.shared.scheduler).

What it does NOT touch
----------------------
Soft-deleted *participants* are deliberately kept: placeholder participants are
referenced ``on_delete=PROTECT`` by the payment/owed shares of *live* expenses
(so old expenses still resolve a name), and hard-deleting them would either
raise ``ProtectedError`` or orphan active ledger rows.  They are lightweight
identity rows, so we retain them indefinitely.

Cascade behaviour
-----------------
Deleting a Group/Friendship cascades to its expenses, settlements, memberships
and receipts.  Receipt *files* are not removed by the cascade, so we strip the
on-disk blobs first.

Activity events (and their notifications) are the exception: their group/
friendship FKs are ``SET_NULL``, so the history survives the purge as
context-less rows rather than being deleted with the container.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from splex.expenses.models import Expense
from splex.expenses.receipts import (
    delete_receipts_for_expense,
    delete_receipts_for_friendship,
    delete_receipts_for_group,
)
from splex.friends.models import Friendship
from splex.groups.models import Group, GroupMembership
from splex.settlements.models import Settlement

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Permanently delete records that have been soft-deleted longer than the "
        "configured data-retention period."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be purged without deleting anything.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        retention_months = getattr(settings, "DATA_RETENTION_INACTIVE_MONTHS", 6)

        if retention_months <= 0:
            self.stdout.write(
                "Soft-delete purge disabled (DATA_RETENTION_INACTIVE_MONTHS=0). Nothing to do."
            )
            return

        # Month approximation, matching enforce_data_retention.
        retention_days = retention_months * 30
        cutoff = timezone.now() - timedelta(days=retention_days)

        if dry_run:
            self.stdout.write(self.style.WARNING("[DRY RUN] No changes will be made."))
            self.stdout.write(
                f"Retention period : {retention_months} months ({retention_days} days)\n"
                f"Purge cutoff     : soft-deleted before {cutoff:%Y-%m-%d %H:%M UTC}\n"
            )

        # Leaves first (clean their receipt blobs), then the containers whose
        # cascade mops up anything still attached.
        expenses = self._purge_expenses(cutoff, dry_run)
        settlements = self._purge_settlements(cutoff, dry_run)
        memberships = self._purge_memberships(cutoff, dry_run)
        friendships = self._purge_friendships(cutoff, dry_run)
        groups = self._purge_groups(cutoff, dry_run)

        prefix = "[DRY RUN] Would purge" if dry_run else "Purged"
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix}: {groups} group(s), {friendships} friendship(s), "
                f"{expenses} expense(s), {settlements} settlement(s), "
                f"{memberships} membership(s)."
            )
        )

    def _purge_expenses(self, cutoff, dry_run) -> int:
        qs = Expense.objects.filter(deleted_at__lt=cutoff)
        if dry_run:
            return qs.count()
        # Materialise before deleting: streaming a cursor while cascading deletes
        # from the same tables is unsafe on some backends.
        expenses = list(qs)
        count = 0
        for expense in expenses:
            try:
                delete_receipts_for_expense(expense)
                expense.delete()
                count += 1
            except Exception:
                logger.exception("Failed to purge soft-deleted expense_id=%s", expense.id)
        return count

    def _purge_settlements(self, cutoff, dry_run) -> int:
        qs = Settlement.objects.filter(deleted_at__lt=cutoff)
        if dry_run:
            return qs.count()
        deleted, _ = qs.delete()
        return deleted

    def _purge_memberships(self, cutoff, dry_run) -> int:
        qs = GroupMembership.objects.filter(removed_at__lt=cutoff)
        if dry_run:
            return qs.count()
        deleted, _ = qs.delete()
        return deleted

    def _purge_friendships(self, cutoff, dry_run) -> int:
        qs = Friendship.objects.filter(ended_at__lt=cutoff)
        if dry_run:
            return qs.count()
        friendships = list(qs)
        count = 0
        for friendship in friendships:
            try:
                delete_receipts_for_friendship(friendship)
                friendship.delete()
                count += 1
            except Exception:
                logger.exception("Failed to purge ended friendship_id=%s", friendship.id)
        return count

    def _purge_groups(self, cutoff, dry_run) -> int:
        qs = Group.objects.filter(deleted_at__lt=cutoff)
        if dry_run:
            return qs.count()
        groups = list(qs)
        count = 0
        for group in groups:
            try:
                delete_receipts_for_group(group)
                group.delete()
                count += 1
            except Exception:
                logger.exception("Failed to purge deleted group_id=%s", group.id)
        return count

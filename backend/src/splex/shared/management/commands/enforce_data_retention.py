"""enforce_data_retention - inactivity warnings and automatic account deletion.

This command is run automatically every 24 hours by Splex's built-in background
scheduler (splex.shared.scheduler).  You can also invoke it manually at any time,
for example to test the logic or force an immediate run:

    python manage.py enforce_data_retention --dry-run

Lifecycle for an inactive account
----------------------------------
  retention – 14 days   → first warning e-mail sent (deletion_date shown)
  retention – 7 days    → final warning e-mail sent
  retention             → account deleted (same logic as the self-service
                          "delete account" flow: solo-member groups are
                          deleted, shared groups get the user converted to
                          an unregistered placeholder)

The retention period is set via DATA_RETENTION_INACTIVE_MONTHS in .env
(default: 6).  Set it to 0 to disable automatic deletion entirely.

"Last active" is defined as max(last_login, date_joined).  last_login is
updated on every explicit login and at most once per 24 h on token refresh.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db.models.functions import Coalesce
from django.utils import timezone

from splex.accounts.services import _send_template_email, delete_account

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Send inactivity warning emails and delete accounts that have exceeded "
        "the configured data-retention period."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would happen without sending emails or deleting accounts.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        retention_months = getattr(settings, "DATA_RETENTION_INACTIVE_MONTHS", 6)

        if retention_months <= 0:
            self.stdout.write(
                "Data retention is disabled (DATA_RETENTION_INACTIVE_MONTHS=0). Nothing to do."
            )
            return

        retention_days = retention_months * 30  # close enough for month approximation
        now = timezone.now()

        # Cutoff dates relative to now
        deletion_cutoff = now - timedelta(days=retention_days)
        warn_7d_cutoff = now - timedelta(days=retention_days - 7)
        warn_14d_cutoff = now - timedelta(days=retention_days - 14)

        if dry_run:
            self.stdout.write(self.style.WARNING("[DRY RUN] No changes will be made."))
            self.stdout.write(
                f"Retention period : {retention_months} months ({retention_days} days)\n"
                f"Deletion cutoff  : {deletion_cutoff:%Y-%m-%d %H:%M UTC}\n"
                f"7-day warning    : last_active < {warn_7d_cutoff:%Y-%m-%d %H:%M UTC}\n"
                f"14-day warning   : last_active < {warn_14d_cutoff:%Y-%m-%d %H:%M UTC}\n"
            )

        User = get_user_model()

        # Annotate every non-staff user with their effective last-active timestamp.
        qs = User.objects.annotate(
            last_active=Coalesce("last_login", "date_joined")
        ).filter(is_staff=False, is_superuser=False)

        # ── First notice (≈14 days before deletion) ───────────────────────────
        first_notice_qs = qs.filter(
            last_active__lt=warn_14d_cutoff,
            last_active__gte=deletion_cutoff,  # not yet past the deletion threshold
            retention_first_notice_sent_at__isnull=True,
        )
        warned_first = self._send_warnings(
            users=list(first_notice_qs),
            retention_days=retention_days,
            now=now,
            flag_field="retention_first_notice_sent_at",
            dry_run=dry_run,
        )

        # ── Second notice (≈7 days before deletion) ───────────────────────────
        second_notice_qs = qs.filter(
            last_active__lt=warn_7d_cutoff,
            last_active__gte=deletion_cutoff,
            retention_second_notice_sent_at__isnull=True,
        )
        warned_second = self._send_warnings(
            users=list(second_notice_qs),
            retention_days=retention_days,
            now=now,
            flag_field="retention_second_notice_sent_at",
            dry_run=dry_run,
        )

        # ── Deletion ──────────────────────────────────────────────────────────
        users_to_delete = list(qs.filter(last_active__lt=deletion_cutoff))
        deleted = self._delete_accounts(users_to_delete, dry_run=dry_run)

        # ── Summary ───────────────────────────────────────────────────────────
        prefix = "[DRY RUN] Would have sent" if dry_run else "Sent"
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefix} first notices: {warned_first} | "
                f"second notices: {warned_second} | "
                f"deleted accounts: {deleted}"
            )
        )

    # ── helpers ───────────────────────────────────────────────────────────────

    def _send_warnings(self, *, users, retention_days, now, flag_field, dry_run):
        sent = 0
        for user in users:
            last_active = user.last_login or user.date_joined
            deletion_date = last_active + timedelta(days=retention_days)
            days_remaining = max(1, (deletion_date - now).days)

            if dry_run:
                self.stdout.write(
                    f"  Would warn ({days_remaining}d remaining): {user.email} "
                    f"[last_active={last_active:%Y-%m-%d}]"
                )
                sent += 1
                continue

            try:
                _send_template_email(
                    subject=f"Your Splex account will be deleted in {days_remaining} days",
                    recipient=user.email,
                    template_base="retention_warning",
                    context={
                        "display_name": (user.display_name or "").strip(),
                        "email": user.email,
                        "days_remaining": days_remaining,
                        "deletion_date": deletion_date.strftime("%B %-d, %Y"),
                        "frontend_url": settings.FRONTEND_PUBLIC_URL,
                    },
                )
                setattr(user, flag_field, now)
                user.save(update_fields=[flag_field])
                sent += 1
                logger.info(
                    "Sent retention warning (%s days remaining) to user_id=%s",
                    days_remaining,
                    user.pk,
                )
            except Exception:
                logger.exception(
                    "Failed to send retention warning to user_id=%s", user.pk
                )

        return sent

    def _delete_accounts(self, users, *, dry_run):
        deleted = 0
        for user in users:
            if dry_run:
                last_active = user.last_login or user.date_joined
                self.stdout.write(
                    f"  Would delete: {user.email} "
                    f"[last_active={last_active:%Y-%m-%d}]"
                )
                deleted += 1
                continue

            try:
                delete_account(actor=user)
                deleted += 1
                logger.info("Deleted inactive account via data retention: user_id=%s", user.pk)
            except Exception:
                logger.exception(
                    "Failed to delete account via data retention for user_id=%s", user.pk
                )

        return deleted

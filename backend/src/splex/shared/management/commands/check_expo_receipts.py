"""check_expo_receipts - fetch Expo delivery receipts for recently sent pushes.

Expo reports ``DeviceNotRegistered`` reliably only in the receipt (available
~30 minutes after the send), not in the ticket returned by the send call.
This job fetches the due receipts and deletes device tokens that Expo
confirms are dead, so uninstalled apps don't keep a token row forever.

Run automatically every hour by the background scheduler.
"""

import logging

from django.core.management.base import BaseCommand

from splex.notifications.services import check_expo_push_receipts

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Check Expo push receipts and delete tokens reported as dead."

    def handle(self, *args, **options):
        checked, deleted = check_expo_push_receipts()
        self.stdout.write(
            self.style.SUCCESS(
                f"Checked {checked} Expo receipt(s), deleted {deleted} dead token(s)."
            )
        )

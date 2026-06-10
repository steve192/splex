"""cleanup_push_endpoints - delete push endpoints whose TTL expired.

A device token / web-push subscription is kept alive by either of two signals:
the app re-registering it on launch (``updated_at``) or a delivery the push
service confirmed (``last_success_at``).  Rows with neither signal for
``PUSH_TOKEN_TTL_DAYS`` belong to devices that are gone (uninstalled, logged
out and abandoned, browser data cleared) and are deleted.

A device that outlives the TTL and comes back simply re-registers its token on
the next app launch - deletion is invisible to the client.  Dead endpoints are
additionally deleted immediately when a send fails terminally (see
notifications.services); this job only mops up rows that never get sends.

Run automatically every 24 h by the background scheduler.
"""

import logging

from django.conf import settings
from django.core.management.base import BaseCommand

from splex.notifications.services import purge_expired_push_endpoints

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Delete push endpoints not re-registered or delivered to within the TTL."

    def handle(self, *args, **options):
        ttl_days = getattr(settings, "PUSH_TOKEN_TTL_DAYS", 365)
        if ttl_days <= 0:
            self.stdout.write("Push endpoint TTL cleanup disabled (PUSH_TOKEN_TTL_DAYS<=0).")
            return
        tokens, subscriptions = purge_expired_push_endpoints(ttl_days)
        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {tokens} expired device token(s) and "
                f"{subscriptions} expired web push subscription(s)."
            )
        )

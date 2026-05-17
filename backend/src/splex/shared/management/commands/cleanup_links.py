from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from splex.accounts.models import MagicLoginChallenge
from splex.invitations.models import Invitation


class Command(BaseCommand):
    help = "Delete expired or already-used magic login challenges and invitation links."

    def add_arguments(self, parser):
        parser.add_argument(
            "--older-than-days",
            type=int,
            default=7,
            help="Keep used/expired link records for this many days before deleting them.",
        )

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(days=options["older_than_days"])
        challenge_filter = Q(expires_at__lt=cutoff) | Q(
            consumed_at__isnull=False,
            consumed_at__lt=cutoff,
        )
        invitation_filter = (
            Q(expires_at__lt=cutoff)
            | Q(accepted_at__isnull=False, accepted_at__lt=cutoff)
            | Q(revoked_at__isnull=False, revoked_at__lt=cutoff)
        )

        deleted_challenges, _ = MagicLoginChallenge.objects.filter(challenge_filter).delete()
        deleted_invitations, _ = Invitation.objects.filter(invitation_filter).delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {deleted_challenges} magic login records and "
                f"{deleted_invitations} invitation records."
            )
        )

from django.db import models
from django.db.models import Q

from splex.shared.models import TimeStampedModel


class Friendship(TimeStampedModel):
    class Source(models.TextChoices):
        EXPLICIT = "explicit", "Explicit"
        SHARED_GROUP = "shared_group", "Shared group"

    participant_a = models.ForeignKey(
        "participants.Participant", on_delete=models.CASCADE, related_name="friendships_a"
    )
    participant_b = models.ForeignKey(
        "participants.Participant", on_delete=models.CASCADE, related_name="friendships_b"
    )
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.EXPLICIT)
    default_currency = models.CharField(max_length=3, default="EUR")
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            # At most one *active* friendship per pair, regardless of how it was
            # established (explicit invite vs auto-created from a shared group).
            # Ended friendships (ended_at not null) are excluded so unfriend+
            # refriend cycles remain possible.
            models.UniqueConstraint(
                fields=["participant_a", "participant_b"],
                condition=Q(ended_at__isnull=True),
                name="unique_active_friendship_pair",
            ),
        ]


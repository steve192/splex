from django.db import models
from django.db.models import Q

from splex.shared.managers import SoftDeletableManager
from splex.shared.models import TimeStampedModel


class Friendship(TimeStampedModel):
    SOFT_DELETE_FIELD = "ended_at"

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
    # Archiving is a *personal* preference: each side decides independently
    # whether the friend is tucked away in their own list, so it is stored
    # per participant rather than as a single shared flag (unlike Group).
    participant_a_archived_at = models.DateTimeField(null=True, blank=True)
    participant_b_archived_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeletableManager()

    def archived_at_for(self, participant):
        return (
            self.participant_a_archived_at
            if self.participant_a_id == participant.id
            else self.participant_b_archived_at
        )

    def set_archived_for(self, participant, value):
        if self.participant_a_id == participant.id:
            self.participant_a_archived_at = value
            return "participant_a_archived_at"
        self.participant_b_archived_at = value
        return "participant_b_archived_at"

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


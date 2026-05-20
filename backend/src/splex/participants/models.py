from django.conf import settings
from django.db import models

from splex.shared.models import TimeStampedModel


class Participant(TimeStampedModel):
    class Kind(models.TextChoices):
        REGISTERED = "registered", "Registered"
        UNREGISTERED = "unregistered", "Unregistered"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="participant",
    )
    display_name = models.CharField(max_length=150)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.UNREGISTERED)

    @property
    def effective_display_name(self) -> str:
        """Current name for this participant.

        For registered participants, the linked user's `display_name` (or email
        prefix) is the source of truth, so a User rename is reflected everywhere
        without denormalization. For unregistered placeholders, the stored
        `display_name` is the source of truth.
        """
        if self.user_id and self.user:
            return self.user.display_name or self.user.email.split("@")[0]
        return self.display_name

    def __str__(self) -> str:
        return self.effective_display_name


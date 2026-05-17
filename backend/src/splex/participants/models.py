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

    def __str__(self) -> str:
        return self.display_name


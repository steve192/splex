from django.conf import settings
from django.db import models

from splex.shared.models import TimeStampedModel


class Settlement(TimeStampedModel):
    client_id = models.CharField(max_length=64, blank=True)
    group = models.ForeignKey("groups.Group", null=True, blank=True, on_delete=models.CASCADE)
    friendship = models.ForeignKey(
        "friends.Friendship", null=True, blank=True, on_delete=models.CASCADE
    )
    payer_participant = models.ForeignKey(
        "participants.Participant", on_delete=models.PROTECT, related_name="settlements_paid"
    )
    receiver_participant = models.ForeignKey(
        "participants.Participant", on_delete=models.PROTECT, related_name="settlements_received"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    deleted_at = models.DateTimeField(null=True, blank=True)


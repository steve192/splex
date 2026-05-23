from django.conf import settings
from django.db import models

from splex.shared.managers import SoftDeletableManager
from splex.shared.models import TimeStampedModel


class Expense(TimeStampedModel):
    SOFT_DELETE_FIELD = "deleted_at"

    class SplitMethod(models.TextChoices):
        EQUAL_ALL = "equal_all", "Equal all"
        EQUAL_SELECTED = "equal_selected", "Equal selected"
        PERCENTAGE = "percentage", "Percentage"
        EXACT = "exact", "Exact"
        ADJUSTED_EQUAL = "adjusted_equal", "Adjusted equal"

    client_id = models.CharField(max_length=64, blank=True)
    group = models.ForeignKey("groups.Group", null=True, blank=True, on_delete=models.CASCADE)
    friendship = models.ForeignKey(
        "friends.Friendship", null=True, blank=True, on_delete=models.CASCADE
    )
    description = models.CharField(max_length=240)
    date = models.DateField()
    original_amount = models.DecimalField(max_digits=12, decimal_places=2)
    original_currency = models.CharField(max_length=3)
    converted_amount = models.DecimalField(max_digits=12, decimal_places=2)
    converted_currency = models.CharField(max_length=3)
    exchange_rate = models.DecimalField(max_digits=18, decimal_places=8, default=1)
    exchange_rate_source = models.CharField(max_length=80, default="identity")
    split_method = models.CharField(max_length=32, choices=SplitMethod.choices)
    split_metadata = models.JSONField(default=dict, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    approximate_location = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeletableManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["created_by", "client_id"],
                condition=~models.Q(client_id=""),
                name="expense_unique_client_id_per_user",
            ),
        ]


class ExpensePaymentShare(models.Model):
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name="payment_shares")
    participant = models.ForeignKey("participants.Participant", on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3)


class ExpenseOwedShare(models.Model):
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name="owed_shares")
    participant = models.ForeignKey("participants.Participant", on_delete=models.PROTECT)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3)


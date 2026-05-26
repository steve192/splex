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


class Receipt(TimeStampedModel):
    """A user-uploaded receipt (image or PDF) attached to an expense.

    A receipt can also exist in "draft" state, where ``expense`` is null but
    ``client_id`` and ``uploaded_by`` are set.  Drafts are matched to a created
    expense by ``(uploaded_by, client_id)`` and the cleanup job removes drafts
    that stay orphaned for longer than ``RECEIPT_DRAFT_RETENTION_HOURS``.
    """

    class ContentType(models.TextChoices):
        JPEG = "image/jpeg", "JPEG"
        PNG = "image/png", "PNG"
        WEBP = "image/webp", "WebP"
        PDF = "application/pdf", "PDF"

    # NULL while draft; FK to the expense once attached.
    expense = models.ForeignKey(
        Expense,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="receipts",
    )
    # Context refs are denormalized so we can enforce the per-group quota and
    # clean up storage on group deletion without joining through Expense.
    group = models.ForeignKey(
        "groups.Group",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="receipts",
    )
    friendship = models.ForeignKey(
        "friends.Friendship",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_receipts",
    )
    # Matches the client_id used by the AddScreen for offline-sync - lets us
    # link drafts uploaded before the expense was saved to the eventual expense.
    client_id = models.CharField(max_length=64, blank=True)
    # Path inside Django's default storage backend.
    storage_path = models.CharField(max_length=500)
    original_filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=64, choices=ContentType.choices)
    size_bytes = models.PositiveBigIntegerField()

    class Meta:
        indexes = [
            models.Index(fields=["uploaded_by", "client_id"]),
            models.Index(fields=["group"]),
            models.Index(fields=["friendship"]),
            models.Index(fields=["expense"]),
        ]

    def __str__(self) -> str:
        return f"Receipt({self.original_filename}, expense_id={self.expense_id})"


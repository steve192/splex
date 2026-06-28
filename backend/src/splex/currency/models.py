from django.db import models
from django.utils import timezone


class CurrencyRateSnapshot(models.Model):
    base_currency = models.CharField(max_length=3)
    rate_date = models.DateField(default=timezone.localdate, db_index=True)
    rates = models.JSONField()
    source = models.CharField(max_length=80)
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fetched_at"]

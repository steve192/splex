from django.db import models


class CurrencyRateSnapshot(models.Model):
    base_currency = models.CharField(max_length=3)
    rates = models.JSONField()
    source = models.CharField(max_length=80)
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fetched_at"]


class ExchangeRate(models.Model):
    base_currency = models.CharField(max_length=3)
    quote_currency = models.CharField(max_length=3)
    rate = models.DecimalField(max_digits=18, decimal_places=8)
    source = models.CharField(max_length=80)
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-fetched_at"]

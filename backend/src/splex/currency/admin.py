from django.contrib import admin

from .models import CurrencyRateSnapshot, ExchangeRate


@admin.register(CurrencyRateSnapshot)
class CurrencyRateSnapshotAdmin(admin.ModelAdmin):
    date_hierarchy = "fetched_at"
    list_display = ("id", "base_currency", "source", "fetched_at")
    list_filter = ("base_currency", "source")
    search_fields = ("base_currency", "source")
    readonly_fields = ("fetched_at",)


@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    date_hierarchy = "fetched_at"
    list_display = (
        "id",
        "base_currency",
        "quote_currency",
        "rate",
        "source",
        "fetched_at",
    )
    list_filter = ("base_currency", "quote_currency", "source")
    search_fields = ("base_currency", "quote_currency", "source")
    readonly_fields = ("fetched_at",)

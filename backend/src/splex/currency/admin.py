from django.contrib import admin

from .models import CurrencyRateSnapshot


@admin.register(CurrencyRateSnapshot)
class CurrencyRateSnapshotAdmin(admin.ModelAdmin):
    date_hierarchy = "fetched_at"
    list_display = ("id", "base_currency", "rate_date", "source", "fetched_at")
    list_filter = ("base_currency", "rate_date", "source")
    search_fields = ("base_currency", "source")
    readonly_fields = ("fetched_at",)

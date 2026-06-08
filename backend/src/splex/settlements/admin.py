from django.contrib import admin

from splex.shared.admin import NoAddNoDeleteAdminMixin

from .models import Settlement


@admin.register(Settlement)
class SettlementAdmin(NoAddNoDeleteAdminMixin, admin.ModelAdmin):
    list_display = (
        "id",
        "payer_participant",
        "receiver_participant",
        "amount",
        "currency",
        "kind",
        "group",
        "friendship",
        "created_by",
        "deleted_at",
        "created_at",
    )
    list_filter = ("kind", "currency", "deleted_at")
    search_fields = (
        "client_id",
        "payer_participant__display_name",
        "receiver_participant__display_name",
        "group__name",
    )
    raw_id_fields = (
        "group",
        "friendship",
        "payer_participant",
        "receiver_participant",
        "created_by",
    )
    readonly_fields = ("created_at", "updated_at")

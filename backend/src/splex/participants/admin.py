from django.contrib import admin

from splex.shared.admin import NoAddNoDeleteAdminMixin

from .models import Participant


@admin.register(Participant)
class ParticipantAdmin(NoAddNoDeleteAdminMixin, admin.ModelAdmin):
    list_display = (
        "id",
        "effective_display_name",
        "kind",
        "user",
        "deleted_at",
        "created_at",
    )
    list_filter = ("kind", "deleted_at")
    search_fields = ("display_name", "user__email", "user__display_name")
    raw_id_fields = ("user",)
    readonly_fields = ("created_at", "updated_at")

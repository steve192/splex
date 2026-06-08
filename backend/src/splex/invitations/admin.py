from django.contrib import admin

from .models import Invitation


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "type",
        "group",
        "target_participant",
        "invited_by",
        "accepted_by",
        "expires_at",
        "accepted_at",
        "revoked_at",
        "created_at",
    )
    list_filter = ("type", "expires_at", "accepted_at", "revoked_at")
    search_fields = (
        "token_hash",
        "invited_by__email",
        "accepted_by__email",
        "group__name",
    )
    raw_id_fields = ("group", "target_participant", "invited_by", "accepted_by")
    readonly_fields = ("token_hash", "created_at")

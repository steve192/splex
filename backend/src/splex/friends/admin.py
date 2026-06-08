from django.contrib import admin

from .models import Friendship


@admin.register(Friendship)
class FriendshipAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "participant_a",
        "participant_b",
        "source",
        "default_currency",
        "ended_at",
        "created_at",
    )
    list_filter = ("source", "default_currency", "ended_at")
    search_fields = (
        "participant_a__display_name",
        "participant_b__display_name",
    )
    raw_id_fields = ("participant_a", "participant_b")
    readonly_fields = ("created_at", "updated_at")

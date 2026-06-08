from django.contrib import admin

from .models import ActivityEvent


@admin.register(ActivityEvent)
class ActivityEventAdmin(admin.ModelAdmin):
    date_hierarchy = "created_at"
    list_display = (
        "id",
        "event_type",
        "actor",
        "group",
        "friendship",
        "expense",
        "settlement",
        "created_at",
    )
    list_filter = ("event_type",)
    search_fields = ("event_type", "actor__email", "group__name")
    raw_id_fields = ("actor", "group", "friendship", "expense", "settlement")
    readonly_fields = ("created_at",)

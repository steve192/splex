from django.contrib import admin

from .models import ClientMutation


@admin.register(ClientMutation)
class ClientMutationAdmin(admin.ModelAdmin):
    date_hierarchy = "created_at"
    list_display = (
        "id",
        "user",
        "mutation_type",
        "client_mutation_id",
        "status",
        "created_at",
        "processed_at",
    )
    list_filter = ("status", "mutation_type")
    search_fields = ("user__email", "client_mutation_id", "mutation_type")
    raw_id_fields = ("user",)
    readonly_fields = ("created_at",)

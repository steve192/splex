from django.contrib import admin

from splex.shared.admin import NoAddNoDeleteAdminMixin

from .models import Group, GroupMembership


class GroupMembershipInline(admin.TabularInline):
    model = GroupMembership
    extra = 0
    raw_id_fields = ("participant",)
    readonly_fields = ("joined_at",)


@admin.register(Group)
class GroupAdmin(NoAddNoDeleteAdminMixin, admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "default_currency",
        "created_by",
        "archived_at",
        "deleted_at",
        "created_at",
    )
    list_filter = ("default_currency", "archived_at", "deleted_at")
    search_fields = ("name",)
    raw_id_fields = ("created_by",)
    readonly_fields = ("created_at", "updated_at")
    inlines = (GroupMembershipInline,)


@admin.register(GroupMembership)
class GroupMembershipAdmin(admin.ModelAdmin):
    list_display = ("id", "group", "participant", "role", "joined_at", "removed_at")
    list_filter = ("role", "removed_at")
    search_fields = ("group__name", "participant__display_name")
    raw_id_fields = ("group", "participant")
    readonly_fields = ("joined_at",)

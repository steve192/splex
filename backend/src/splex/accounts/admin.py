from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import MagicLoginChallenge, PaymentMethod, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    # The custom User has no `username`; log in / identify by email.
    ordering = ("email",)
    list_display = (
        "id",
        "email",
        "display_name",
        "default_currency",
        "locale",
        "is_staff",
        "is_superuser",
        "is_active",
        "date_joined",
    )
    list_filter = ("is_staff", "is_superuser", "is_active", "push_enabled", "locale")
    search_fields = ("email", "display_name")
    readonly_fields = ("date_joined", "last_login")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "Profile",
            {
                "fields": (
                    "display_name",
                    "default_currency",
                    "avatar_url",
                    "avatar_attribution",
                    "locale",
                    "push_enabled",
                    "location_tracking_enabled",
                )
            },
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        (
            "Retention",
            {
                "fields": (
                    "retention_first_notice_sent_at",
                    "retention_second_notice_sent_at",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password1", "password2", "is_staff", "is_superuser"),
            },
        ),
    )

    # Privilege fields a non-superuser staff member must not be able to grant
    # themselves (classic Django admin escalation vector).
    _privilege_fields = ("is_superuser", "is_staff", "groups", "user_permissions")

    def get_readonly_fields(self, request, obj=None):
        readonly = super().get_readonly_fields(request, obj)
        if not request.user.is_superuser:
            readonly = tuple(readonly) + self._privilege_fields
        return readonly


@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "kind", "identifier", "is_preferred", "created_at")
    list_filter = ("kind", "is_preferred")
    search_fields = ("identifier", "user__email", "user__display_name")
    raw_id_fields = ("user",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(MagicLoginChallenge)
class MagicLoginChallengeAdmin(admin.ModelAdmin):
    list_display = ("id", "email", "expires_at", "consumed_at", "created_at")
    list_filter = ("consumed_at",)
    search_fields = ("email",)
    readonly_fields = ("created_at",)

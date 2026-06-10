from django.contrib import admin

from .models import DeviceToken, Notification, VapidKey, WebPushSubscription


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    date_hierarchy = "created_at"
    list_display = (
        "id",
        "user",
        "title_key",
        "status",
        "activity_event",
        "created_at",
        "sent_at",
    )
    list_filter = ("status",)
    search_fields = ("user__email", "title_key", "body_key")
    raw_id_fields = ("user", "activity_event")
    readonly_fields = ("created_at",)


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = (
        "id", "user", "platform", "enabled", "created_at", "updated_at", "last_success_at",
    )
    list_filter = ("platform", "enabled")
    # `token` (raw FCM token) is intentionally not searchable to avoid exposing
    # the credential through admin queries/logs.
    search_fields = ("user__email",)
    raw_id_fields = ("user",)
    # The push credential itself is never rendered in the admin.
    exclude = ("token",)
    readonly_fields = ("created_at", "updated_at", "last_success_at")


@admin.register(WebPushSubscription)
class WebPushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "enabled", "created_at", "updated_at", "last_success_at")
    list_filter = ("enabled",)
    search_fields = ("user__email",)
    raw_id_fields = ("user",)
    # endpoint/p256dh/auth are push encryption secrets - never render them.
    exclude = ("endpoint", "p256dh", "auth")
    readonly_fields = ("created_at", "updated_at", "last_success_at")


@admin.register(VapidKey)
class VapidKeyAdmin(admin.ModelAdmin):
    list_display = ("id", "active", "expires_at", "created_at")
    list_filter = ("active",)
    # The web-push signing private key must never be viewable or editable here.
    exclude = ("private_key",)
    readonly_fields = ("public_key", "created_at")

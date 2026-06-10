from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    activity_event = models.ForeignKey("activity.ActivityEvent", on_delete=models.CASCADE)
    title_key = models.CharField(max_length=120)
    body_key = models.CharField(max_length=120)
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)


class DeviceToken(models.Model):
    """One push endpoint per app install.

    ``token`` is globally unique: a device belongs to exactly one account at a
    time, so registering a token always moves it to the registering user.
    ``updated_at`` doubles as a liveness heartbeat - the app re-registers on
    every launch.  ``last_success_at`` records the last delivery the push
    service confirmed (web push accept / Expo receipt); either signal counts
    as a sign of life for the TTL cleanup.
    """

    class Platform(models.TextChoices):
        ANDROID = "android", "Android"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    platform = models.CharField(max_length=20, choices=Platform.choices)
    token = models.TextField(unique=True)
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_success_at = models.DateTimeField(null=True, blank=True)


class WebPushSubscription(models.Model):
    """One web-push endpoint per browser installation; see DeviceToken for the
    uniqueness/heartbeat semantics, which apply identically here."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    endpoint = models.TextField(unique=True)
    p256dh = models.TextField()
    auth = models.TextField()
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_success_at = models.DateTimeField(null=True, blank=True)


class ExpoPushTicket(models.Model):
    """A pending Expo delivery receipt for one sent push.

    Expo reports ``DeviceNotRegistered`` reliably only in the *receipt*
    (fetched later via ``getReceipts``), not in the ticket returned by the
    send call - so each send stores its ticket id here and a scheduled job
    checks the receipt and deletes dead tokens.
    """

    device_token = models.ForeignKey(DeviceToken, on_delete=models.CASCADE)
    ticket_id = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)


class VapidKey(models.Model):
    public_key = models.TextField()
    private_key = models.TextField()
    expires_at = models.DateTimeField()
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

import json
from base64 import urlsafe_b64encode
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from splex.notifications.models import DeviceToken, Notification, VapidKey, WebPushSubscription


def users_for_context(group=None, friendship=None):
    User = get_user_model()
    if group:
        return User.objects.filter(
            participant__group_memberships__group=group,
            participant__group_memberships__removed_at__isnull=True,
            push_enabled=True,
        ).distinct()
    if friendship:
        participant_ids = [friendship.participant_a_id, friendship.participant_b_id]
        return User.objects.filter(participant__id__in=participant_ids, push_enabled=True)
    return User.objects.none()


def create_notifications_for_activity(activity_event):
    recipients = users_for_context(activity_event.group, activity_event.friendship).exclude(
        id=activity_event.actor_id
    )
    notifications = [
        Notification(
            user=user,
            activity_event=activity_event,
            title_key=f"activity.{activity_event.event_type}.title",
            body_key=f"activity.{activity_event.event_type}.body",
            payload=activity_event.payload,
        )
        for user in recipients
    ]
    created = Notification.objects.bulk_create(notifications)
    transaction.on_commit(lambda: dispatch_pending_notifications([item.id for item in created]))
    return created


def dispatch_pending_notifications(notification_ids):
    for notification in Notification.objects.filter(id__in=notification_ids):
        errors = []
        sent = False
        for device in DeviceToken.objects.filter(user=notification.user, enabled=True):
            try:
                send_fcm_notification(device.token, notification)
                sent = True
            except Exception as exc:  # noqa: BLE001 - external dispatch failures are recorded.
                errors.append(str(exc))
        subscriptions = WebPushSubscription.objects.filter(
            user=notification.user, enabled=True
        )
        for subscription in subscriptions:
            try:
                send_web_push_notification(subscription, notification)
                sent = True
            except Exception as exc:  # noqa: BLE001 - external dispatch failures are recorded.
                errors.append(str(exc))
        notification.status = Notification.Status.SENT if sent else Notification.Status.FAILED
        notification.sent_at = timezone.now() if sent else None
        notification.error = (
            "\n".join(errors) if errors else "" if sent else "No enabled push subscription."
        )
        notification.save(update_fields=["status", "sent_at", "error"])


def _base64url(value: bytes) -> str:
    return urlsafe_b64encode(value).decode("ascii").rstrip("=")


def generate_vapid_key(expires_at=None) -> VapidKey:
    from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
    from py_vapid import Vapid

    vapid = Vapid()
    vapid.generate_keys()
    public_raw = vapid.public_key.public_bytes(
        encoding=Encoding.X962,
        format=PublicFormat.UncompressedPoint,
    )
    return VapidKey.objects.create(
        public_key=_base64url(public_raw),
        private_key=vapid.private_pem().decode("utf-8"),
        expires_at=expires_at or timezone.now() + timedelta(days=3650),
        active=True,
    )


def get_active_vapid_key() -> VapidKey:
    if settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY:
        return VapidKey(
            public_key=settings.VAPID_PUBLIC_KEY,
            private_key=settings.VAPID_PRIVATE_KEY,
            expires_at=timezone.now() + timedelta(days=3650),
            active=True,
        )
    key = VapidKey.objects.filter(active=True, expires_at__gt=timezone.now()).order_by("-created_at").first()
    if key:
        return key
    VapidKey.objects.filter(active=True).update(active=False)
    return generate_vapid_key()


def send_fcm_notification(token: str, notification: Notification):
    send_expo_notification(token, notification)


def send_expo_notification(token: str, notification: Notification):
    import requests

    response = requests.post(
        "https://exp.host/--/api/v2/push/send",
        json={
            "to": token,
            "title": notification.title_key,
            "body": notification.body_key,
            "data": notification.payload,
        },
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    ticket = payload.get("data", {})
    if isinstance(ticket, dict) and ticket.get("status") == "error":
        raise RuntimeError(ticket.get("message") or "Expo push rejected the notification.")


def send_web_push_notification(subscription: WebPushSubscription, notification: Notification):
    from pywebpush import webpush

    vapid_key = get_active_vapid_key()
    webpush(
        subscription_info={
            "endpoint": subscription.endpoint,
            "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
        },
        data=json.dumps(
            {
                "title": notification.title_key,
                "body": notification.body_key,
                "payload": notification.payload,
            }
        ),
        vapid_private_key=vapid_key.private_key,
        vapid_claims={"sub": settings.VAPID_SUBJECT},
    )

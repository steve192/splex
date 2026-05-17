import json

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from splex.notifications.models import DeviceToken, Notification, WebPushSubscription


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


_firebase_ready = False


def ensure_firebase_ready():
    global _firebase_ready
    if _firebase_ready:
        return
    if not settings.FCM_CREDENTIALS_JSON:
        raise RuntimeError("FCM credentials are not configured.")
    import firebase_admin
    from firebase_admin import credentials

    if not firebase_admin._apps:
        credentials_data = json.loads(settings.FCM_CREDENTIALS_JSON)
        firebase_admin.initialize_app(credentials.Certificate(credentials_data))
    _firebase_ready = True


def send_fcm_notification(token: str, notification: Notification):
    ensure_firebase_ready()
    from firebase_admin import messaging

    message = messaging.Message(
        token=token,
        notification=messaging.Notification(
            title=notification.title_key,
            body=notification.body_key,
        ),
        data={key: str(value) for key, value in notification.payload.items()},
    )
    messaging.send(message)


def send_web_push_notification(subscription: WebPushSubscription, notification: Notification):
    if not settings.VAPID_PRIVATE_KEY:
        raise RuntimeError("VAPID keys are not configured.")
    from pywebpush import webpush

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
        vapid_private_key=settings.VAPID_PRIVATE_KEY,
        vapid_claims={"sub": settings.VAPID_SUBJECT},
    )

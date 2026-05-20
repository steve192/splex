import json
import logging
from base64 import urlsafe_b64encode
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from splex.notifications.models import DeviceToken, Notification, VapidKey, WebPushSubscription
from splex.notifications.translations import render_notification

logger = logging.getLogger(__name__)


class TerminalDispatchError(Exception):
    """Push endpoint is permanently gone (token unregistered / subscription expired).

    Raised so the dispatcher can delete the dead row instead of retrying it forever.
    """


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


def _actor_name(actor) -> str:
    return actor.display_name or actor.email.split("@")[0]


def _context_name_for(activity_event, recipient) -> str:
    if activity_event.group_id:
        return activity_event.group.name
    if activity_event.friendship_id:
        friendship = activity_event.friendship
        recipient_pid = getattr(recipient, "participant", None)
        recipient_pid = getattr(recipient_pid, "id", None)
        other = (
            friendship.participant_b
            if friendship.participant_a_id == recipient_pid
            else friendship.participant_a
        )
        return other.effective_display_name
    return ""


def create_notifications_for_activity(activity_event):
    recipients = users_for_context(activity_event.group, activity_event.friendship).exclude(
        id=activity_event.actor_id
    )
    actor_name = _actor_name(activity_event.actor)
    base_payload = activity_event.payload or {}
    notifications = []
    for user in recipients:
        payload = {
            **base_payload,
            "actor": actor_name,
            "context": _context_name_for(activity_event, user),
        }
        notifications.append(
            Notification(
                user=user,
                activity_event=activity_event,
                title_key=f"activity.{activity_event.event_type}.title",
                body_key=f"activity.{activity_event.event_type}.body",
                payload=payload,
            )
        )
    created = Notification.objects.bulk_create(notifications)
    transaction.on_commit(lambda: dispatch_pending_notifications([item.id for item in created]))
    return created


def _render_for_user(notification):
    event_type = notification.title_key.removeprefix("activity.").removesuffix(".title")
    locale = getattr(notification.user, "locale", "en") or "en"
    return render_notification(event_type, notification.payload or {}, locale)


def _dispatch_one(notification, title, body):
    errors = []
    sent = False
    for device in DeviceToken.objects.filter(user=notification.user, enabled=True):
        try:
            send_expo_notification(device.token, notification, title, body)
            sent = True
        except TerminalDispatchError as exc:
            logger.info("Expo push token gone, deleting (user_id=%s): %s", notification.user_id, exc)
            errors.append(f"{exc} (token deleted)")
            device.delete()
        except Exception as exc:  # noqa: BLE001 - external dispatch failures are recorded.
            logger.warning(
                "Expo push failed (user_id=%s, notification_id=%s): %s",
                notification.user_id,
                notification.id,
                exc,
            )
            errors.append(str(exc))
    for subscription in WebPushSubscription.objects.filter(user=notification.user, enabled=True):
        try:
            send_web_push_notification(subscription, notification, title, body)
            sent = True
        except TerminalDispatchError as exc:
            logger.info(
                "Web push subscription gone, deleting (user_id=%s): %s",
                notification.user_id,
                exc,
            )
            errors.append(f"{exc} (subscription deleted)")
            subscription.delete()
        except Exception as exc:  # noqa: BLE001 - external dispatch failures are recorded.
            logger.warning(
                "Web push failed (user_id=%s, notification_id=%s, endpoint=%s): %s",
                notification.user_id,
                notification.id,
                subscription.endpoint[:80],
                exc,
            )
            errors.append(str(exc))
    return sent, errors


def dispatch_pending_notifications(notification_ids):
    for notification in Notification.objects.filter(id__in=notification_ids).select_related("user"):
        title, body = _render_for_user(notification)
        sent, errors = _dispatch_one(notification, title, body)
        notification.status = Notification.Status.SENT if sent else Notification.Status.FAILED
        notification.sent_at = timezone.now() if sent else None
        if errors:
            notification.error = "\n".join(errors)
        elif sent:
            notification.error = ""
        else:
            notification.error = "No enabled push subscription."
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


_EXPO_TERMINAL_ERRORS = {"DeviceNotRegistered", "InvalidCredentials"}


def send_expo_notification(token: str, notification: Notification, title: str, body: str):
    import requests

    response = requests.post(
        "https://exp.host/--/api/v2/push/send",
        json={
            "to": token,
            "title": title,
            "body": body,
            "data": notification.payload,
        },
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    ticket = payload.get("data", {})
    if isinstance(ticket, dict) and ticket.get("status") == "error":
        details = ticket.get("details") or {}
        code = details.get("error") if isinstance(details, dict) else None
        message = ticket.get("message") or "Expo push rejected the notification."
        if code in _EXPO_TERMINAL_ERRORS:
            raise TerminalDispatchError(message)
        raise RuntimeError(message)


def send_web_push_notification(
    subscription: WebPushSubscription, notification: Notification, title: str, body: str
):
    from pywebpush import WebPushException, webpush

    vapid_key = get_active_vapid_key()
    try:
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
            },
            data=json.dumps(
                {
                    "title": title,
                    "body": body,
                    "payload": notification.payload,
                }
            ),
            vapid_private_key=vapid_key.private_key,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
        )
    except WebPushException as exc:
        status_code = getattr(getattr(exc, "response", None), "status_code", None)
        if status_code in (404, 410):
            raise TerminalDispatchError(f"Web push subscription gone (HTTP {status_code})") from exc
        raise

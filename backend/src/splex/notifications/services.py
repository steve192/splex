import json
import logging
from base64 import b64decode, urlsafe_b64encode
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from splex.notifications.models import (
    DeviceToken,
    ExpoPushTicket,
    Notification,
    VapidKey,
    WebPushSubscription,
)
from splex.notifications.translations import render_notification

logger = logging.getLogger(__name__)


class TerminalDispatchError(Exception):
    """Push endpoint is permanently gone (token unregistered / subscription expired).

    Raised so the dispatcher can delete the dead row instead of retrying it forever.
    """


def users_for_context(group=None, friendship=None):
    user_model = get_user_model()
    if group:
        return user_model.objects.filter(
            participant__group_memberships__group=group,
            participant__group_memberships__removed_at__isnull=True,
            push_enabled=True,
        ).distinct()
    if friendship:
        participant_ids = [friendship.participant_a_id, friendship.participant_b_id]
        return user_model.objects.filter(participant__id__in=participant_ids, push_enabled=True)
    return user_model.objects.none()


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


def _mark_delivery_success(endpoint):
    """Record a push-service-confirmed delivery on a DeviceToken / WebPushSubscription.

    ``last_success_at`` is what keeps the TTL cleanup from ever deleting an
    endpoint that demonstrably still works.
    """
    endpoint.last_success_at = timezone.now()
    endpoint.save(update_fields=["last_success_at"])


def _record_expo_send(device, ticket_id):
    """Store the Expo ticket so the receipt check can deliver the real verdict.

    An accepted ticket only means Expo queued the message - delivery success or
    ``DeviceNotRegistered`` arrives later in the receipt, so the ticket itself
    does not bump ``last_success_at``.
    """
    if ticket_id:
        ExpoPushTicket.objects.create(device_token=device, ticket_id=ticket_id)


def dispatch_push_to_user(user, *, title, body, data, log_id=""):
    """Send ``(title, body, data)`` to every enabled push endpoint for ``user``.

    Dead endpoints (DeviceToken / WebPushSubscription that the upstream
    push service reports as permanently gone) are deleted so retries don't
    keep hitting them.  Returns ``(sent_any, [error_strings])``.

    ``log_id`` is a stable identifier (e.g. ``"notification=42"`` or
    ``"reminder.settle"``) that appears in warning logs to disambiguate
    which dispatch failed.
    """
    errors = []
    sent = False
    for device in DeviceToken.objects.filter(user=user, enabled=True):
        try:
            ticket_id = send_expo_notification(device.token, title=title, body=body, data=data)
            _record_expo_send(device, ticket_id)
            sent = True
        except TerminalDispatchError as exc:
            logger.info("Expo push token gone, deleting (user_id=%s): %s", user.id, exc)
            errors.append(f"{exc} (token deleted)")
            device.delete()
        except Exception as exc:  # noqa: BLE001 - external dispatch failures are recorded.
            logger.warning(
                "Expo push failed (user_id=%s, %s): %s", user.id, log_id, exc,
            )
            errors.append(str(exc))
    for subscription in WebPushSubscription.objects.filter(user=user, enabled=True):
        try:
            send_web_push_notification(subscription, title=title, body=body, data=data)
            _mark_delivery_success(subscription)
            sent = True
        except TerminalDispatchError as exc:
            logger.info(
                "Web push subscription gone, deleting (user_id=%s): %s", user.id, exc,
            )
            errors.append(f"{exc} (subscription deleted)")
            subscription.delete()
        except Exception as exc:  # noqa: BLE001 - external dispatch failures are recorded.
            logger.warning(
                "Web push failed (user_id=%s, %s, endpoint=%s): %s",
                user.id, log_id, subscription.endpoint[:80], exc,
            )
            errors.append(str(exc))
    return sent, errors


def _dispatch_one(notification, title, body):
    return dispatch_push_to_user(
        notification.user, title=title, body=body, data=notification.payload,
        log_id=f"notification_id={notification.id}",
    )


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


def _strip_wrapping_quotes(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def _decode_pem_base64(value: str) -> str:
    decoded = b64decode(value, validate=True).decode("utf-8")
    if "-----BEGIN" not in decoded:
        raise ValueError("Decoded value is not PEM data.")
    return decoded


def normalize_vapid_private_key(value: str) -> str:
    normalized = _strip_wrapping_quotes(value.strip())
    if "\\n" in normalized:
        normalized = normalized.replace("\\n", "\n")
    if "-----BEGIN" in normalized:
        return normalized
    try:
        return _decode_pem_base64(normalized)
    except ValueError:
        return normalized


def load_vapid_private_key(value: str):
    from py_vapid import Vapid

    normalized = normalize_vapid_private_key(value)
    if "-----BEGIN" in normalized:
        return normalized, Vapid.from_pem(normalized.encode("utf-8"))
    return normalized, Vapid.from_string(private_key=normalized)


def validate_vapid_private_key(value: str) -> str:
    try:
        normalized, _vapid = load_vapid_private_key(value)
    except Exception as exc:  # noqa: BLE001 - py_vapid raises cryptography errors directly.
        raise ValueError(
            "Configured VAPID_PRIVATE_KEY is not valid PEM key data. "
            "Use the generated PEM value directly, or store it with escaped newlines."
        ) from exc
    return normalized


def _validate_persisted_vapid_key(key: VapidKey) -> VapidKey:
    try:
        normalized = validate_vapid_private_key(key.private_key)
    except ValueError:
        logger.warning(
            "Stored VAPID key is invalid, rotating automatically (key_id=%s)",
            key.id,
        )
        key.active = False
        key.save(update_fields=["active"])
        return generate_vapid_key()

    if normalized != key.private_key:
        key.private_key = normalized
        key.save(update_fields=["private_key"])
    return key


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
            private_key=validate_vapid_private_key(settings.VAPID_PRIVATE_KEY),
            expires_at=timezone.now() + timedelta(days=3650),
            active=True,
        )
    key = (
        VapidKey.objects.filter(active=True, expires_at__gt=timezone.now())
        .order_by("-created_at")
        .first()
    )
    if key:
        return _validate_persisted_vapid_key(key)
    VapidKey.objects.filter(active=True).update(active=False)
    return generate_vapid_key()


_EXPO_TERMINAL_ERRORS = {"DeviceNotRegistered", "InvalidCredentials"}
_EXPO_JSON_HEADERS = {"Accept": "application/json", "Content-Type": "application/json"}


def send_expo_notification(
    token: str, *, title: str, body: str, data: dict | None = None,
) -> str | None:
    """Send one Expo push and return its ticket id (None if Expo sent none)."""
    import requests

    response = requests.post(
        "https://exp.host/--/api/v2/push/send",
        json={
            "to": token,
            "title": title,
            "body": body,
            "data": data or {},
        },
        headers=_EXPO_JSON_HEADERS,
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    ticket = payload.get("data", {})
    if not isinstance(ticket, dict):
        return None
    if ticket.get("status") == "error":
        details = ticket.get("details") or {}
        code = details.get("error") if isinstance(details, dict) else None
        message_text = ticket.get("message") or "Expo push rejected the notification."
        if code in _EXPO_TERMINAL_ERRORS:
            raise TerminalDispatchError(message_text)
        raise RuntimeError(message_text)
    return ticket.get("id")


def send_web_push_notification(
    subscription: WebPushSubscription, *, title: str, body: str, data: dict | None = None,
):
    from pywebpush import WebPushException, webpush

    vapid_key = get_active_vapid_key()
    _normalized_key, vapid_signer = load_vapid_private_key(vapid_key.private_key)
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
                    "payload": data or {},
                }
            ),
            vapid_private_key=vapid_signer,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
        )
    except WebPushException as exc:
        status_code = getattr(getattr(exc, "response", None), "status_code", None)
        # 404/410: endpoint gone.  401/403: VAPID key mismatch - the
        # subscription was created against a different server key and can
        # never be sent to again, so it is just as dead as a 410.
        if status_code in (401, 403, 404, 410):
            raise TerminalDispatchError(
                f"Web push subscription unusable (HTTP {status_code})"
            ) from exc
        raise


# Receipt checking and expired-endpoint cleanup.
#
# Deletion rules (see also the cleanup_push_endpoints management command):
#   - An endpoint is deleted when the push service confirms it is dead
#     (terminal ticket/receipt error, web push 401/403/404/410).
#   - An endpoint is deleted when its TTL expires: no re-registration (the app
#     re-registers on every launch, bumping ``updated_at``) and no confirmed
#     delivery (``last_success_at``) for PUSH_TOKEN_TTL_DAYS.  Deletion is
#     invisible to a device that comes back later - it simply re-registers on
#     the next launch.

# Expo makes receipts available shortly after the send and keeps them for
# roughly a day; check after 30 minutes, give up after 24 hours.
EXPO_RECEIPT_CHECK_DELAY = timedelta(minutes=30)
EXPO_RECEIPT_MAX_AGE = timedelta(hours=24)
# Expo accepts up to 1000 receipt ids per request; stay well below.
_EXPO_RECEIPT_BATCH_SIZE = 300


def _apply_expo_receipt(ticket, receipt) -> bool:
    """Apply one receipt verdict to its ticket/token.

    Returns True when the device token was deleted (terminal receipt error).
    """
    if isinstance(receipt, dict) and receipt.get("status") == "error":
        details = receipt.get("details") or {}
        code = details.get("error") if isinstance(details, dict) else None
        if code in _EXPO_TERMINAL_ERRORS:
            logger.info(
                "Expo receipt reports token dead, deleting (user_id=%s): %s",
                ticket.device_token.user_id,
                receipt.get("message"),
            )
            ticket.device_token.delete()
            return True
        logger.warning(
            "Expo receipt error (user_id=%s): %s",
            ticket.device_token.user_id,
            receipt.get("message"),
        )
    else:
        _mark_delivery_success(ticket.device_token)
    ticket.delete()
    return False


def _fetch_expo_receipts(ticket_ids: list[str]) -> dict:
    import requests

    response = requests.post(
        "https://exp.host/--/api/v2/push/getReceipts",
        json={"ids": ticket_ids},
        headers=_EXPO_JSON_HEADERS,
        timeout=10,
    )
    response.raise_for_status()
    return response.json().get("data", {})


def check_expo_push_receipts() -> tuple[int, int]:
    """Fetch due Expo receipts; delete tokens Expo reports as dead.

    Returns ``(receipts_checked, tokens_deleted)``.
    """
    now = timezone.now()
    tickets = list(
        ExpoPushTicket.objects.filter(created_at__lt=now - EXPO_RECEIPT_CHECK_DELAY)
        .select_related("device_token")
        .order_by("created_at")
    )
    checked = 0
    deleted_token_ids: set[int] = set()
    for start in range(0, len(tickets), _EXPO_RECEIPT_BATCH_SIZE):
        chunk = tickets[start : start + _EXPO_RECEIPT_BATCH_SIZE]
        receipts = _fetch_expo_receipts([ticket.ticket_id for ticket in chunk])
        for ticket in chunk:
            if ticket.device_token_id in deleted_token_ids:
                continue  # Token already deleted via a sibling ticket (cascades this row).
            receipt = receipts.get(ticket.ticket_id)
            if receipt is None:
                # Not available yet; drop the bookkeeping once Expo has expired it.
                if ticket.created_at < now - EXPO_RECEIPT_MAX_AGE:
                    ticket.delete()
                continue
            checked += 1
            if _apply_expo_receipt(ticket, receipt):
                deleted_token_ids.add(ticket.device_token_id)
    return checked, len(deleted_token_ids)


def purge_expired_push_endpoints(ttl_days: int) -> tuple[int, int]:
    """Delete endpoints with no sign of life for ``ttl_days``.

    "Sign of life" is either a re-registration (the app re-registers its token
    on every launch, bumping ``updated_at``) or a delivery the push service
    confirmed (``last_success_at``).  An expired row therefore belongs to a
    device that neither ran the app nor received a push for the whole window.
    If such a device does come back, its next launch re-registers the token
    and recreates the row, so deletion is invisible to the client.

    Returns ``(device_tokens_deleted, web_subscriptions_deleted)``.
    """
    cutoff = timezone.now() - timedelta(days=ttl_days)
    expired = Q(updated_at__lt=cutoff) & (
        Q(last_success_at__isnull=True) | Q(last_success_at__lt=cutoff)
    )
    _, token_counts = DeviceToken.objects.filter(expired).delete()
    _, subscription_counts = WebPushSubscription.objects.filter(expired).delete()
    return (
        token_counts.get("notifications.DeviceToken", 0),
        subscription_counts.get("notifications.WebPushSubscription", 0),
    )

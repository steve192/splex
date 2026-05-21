from urllib.parse import urlencode

import requests as http_requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from splex.accounts.models import MagicLoginChallenge
from splex.notifications.models import DeviceToken, WebPushSubscription
from splex.participants.services import get_or_create_user_participant

MAGIC_LOGIN_VALID_MINUTES = 15


def _send_template_email(*, subject, recipient, template_base, context):
    """Render a paired .txt + .html template and dispatch as a multipart email."""
    text_body = render_to_string(f"emails/{template_base}.txt", context)
    html_body = render_to_string(f"emails/{template_base}.html", context)
    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient],
    )
    message.attach_alternative(html_body, "text/html")
    message.send(fail_silently=False)


def request_magic_login(email: str, invite_token: str = ""):
    email = email.strip().lower()
    with transaction.atomic():
        MagicLoginChallenge.objects.filter(
            email=email,
            consumed_at__isnull=True,
        ).update(consumed_at=timezone.now())
        challenge, code, token = MagicLoginChallenge.create(email)
    query = {"token": token}
    if invite_token:
        query["inviteToken"] = invite_token
    magic_url = f"{settings.FRONTEND_PUBLIC_URL}/login/magic?{urlencode(query)}"
    _send_template_email(
        subject="Your Splex login code",
        recipient=email,
        template_base="magic_login",
        context={
            "code": code,
            "magic_url": magic_url,
            "minutes_valid": MAGIC_LOGIN_VALID_MINUTES,
        },
    )
    return challenge


@transaction.atomic
def authenticate_magic_code(email: str, code: str):
    challenge = (
        MagicLoginChallenge.objects.select_for_update()
        .filter(email=email.strip().lower())
        .order_by("-created_at")
        .first()
    )
    if not challenge or not challenge.is_valid() or not challenge.verify_code(code):
        raise ValueError("Invalid or expired login code.")
    return consume_challenge(challenge)


@transaction.atomic
def authenticate_magic_token(token: str):
    token_hash = MagicLoginChallenge.hash_token(token)
    challenge = MagicLoginChallenge.objects.select_for_update().filter(token_hash=token_hash).first()
    if not challenge or not challenge.is_valid():
        raise ValueError("Invalid or expired login token.")
    return consume_challenge(challenge)


@transaction.atomic
def authenticate_with_google(*, id_token: str):
    """Verify a Google ID token and return (user, tokens).

    Calls Google's public tokeninfo endpoint to validate the token signature and
    expiry, then checks the audience against the configured client IDs.  Creates
    the user account on first login.
    """
    allowed_client_ids = {
        cid
        for cid in [settings.GOOGLE_CLIENT_ID, settings.GOOGLE_ANDROID_CLIENT_ID]
        if cid
    }
    if not allowed_client_ids:
        raise ValueError("Google login is not configured on this server.")

    try:
        resp = http_requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
            timeout=10,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception:
        raise ValueError("Could not verify Google token.")

    if payload.get("aud") not in allowed_client_ids:
        raise ValueError("Token audience does not match configured client IDs.")

    if payload.get("email_verified") not in (True, "true"):
        raise ValueError("Google account email is not verified.")

    email = payload.get("email", "").strip().lower()
    if not email:
        raise ValueError("No email address in Google token.")

    User = get_user_model()
    if not settings.ALLOW_REGISTRATION:
        try:
            user = User.objects.get(email=email)
            created = False
        except User.DoesNotExist:
            raise ValueError("Registration is disabled on this server.")
    else:
        user, created = User.objects.get_or_create(
            email=email,
            defaults={"display_name": payload.get("name", email.split("@")[0])},
        )
    get_or_create_user_participant(user)
    refresh = RefreshToken.for_user(user)
    return user, {"access": str(refresh.access_token), "refresh": str(refresh), "created": created}


def consume_challenge(challenge):
    User = get_user_model()
    if not settings.ALLOW_REGISTRATION:
        try:
            user = User.objects.get(email=challenge.email)
            created = False
        except User.DoesNotExist:
            raise ValueError("Registration is disabled on this server.")
    else:
        user, created = User.objects.get_or_create(
            email=challenge.email,
            defaults={"display_name": challenge.email.split("@")[0]},
        )
    get_or_create_user_participant(user)
    challenge.consumed_at = timezone.now()
    challenge.save(update_fields=["consumed_at"])
    refresh = RefreshToken.for_user(user)
    return user, {"access": str(refresh.access_token), "refresh": str(refresh), "created": created}


def delete_account(*, actor) -> None:
    """Delete the account and notify the user by email afterwards."""
    # Capture identity before _delete_account_atomic severs the user row.
    email = actor.email
    display_name = (actor.display_name or "").strip()
    _delete_account_atomic(actor=actor)
    if email:
        try:
            _send_template_email(
                subject="Your Splex account has been deleted",
                recipient=email,
                template_base="account_deleted",
                context={
                    "email": email,
                    "display_name": display_name,
                    "frontend_url": settings.FRONTEND_PUBLIC_URL,
                },
            )
        except Exception:
            # Best-effort: account is already gone; don't surface mail errors to the API.
            pass


@transaction.atomic
def _delete_account_atomic(*, actor) -> None:
    """Permanently delete a user account.

    For each group the actor belongs to:
    - If the actor is the only registered active member → soft-delete the group.
    - Otherwise → convert the actor's participant to an unregistered placeholder
      inside that group (expenses and balances are preserved, account link removed).

    Push tokens and web-push subscriptions are removed before the user is deleted.
    The actor's Participant record is left in place (it now holds friend-context
    expense shares that are not group-scoped); its user link is severed by the
    Django CASCADE/SET_NULL when the User row is deleted.
    """
    from splex.groups.models import GroupMembership
    from splex.groups.services import _convert_participant_in_group, delete_group

    participant = get_or_create_user_participant(actor)

    # Snapshot the name now, before we sever the user link.
    display_name = participant.effective_display_name

    active_memberships = list(
        GroupMembership.objects.filter(
            participant=participant,
            removed_at__isnull=True,
        ).select_related("group")
    )

    for membership in active_memberships:
        group = membership.group
        if group.deleted_at:
            continue
        other_registered_exists = GroupMembership.objects.filter(
            group=group,
            removed_at__isnull=True,
            participant__user__isnull=False,
        ).exclude(participant=participant).exists()

        if other_registered_exists:
            _convert_participant_in_group(group=group, participant=participant)
        else:
            delete_group(actor=actor, group=group)

    # Snapshot name on the original participant so friend-context data stays readable.
    participant.display_name = display_name
    participant.kind = participant.Kind.UNREGISTERED
    participant.user = None
    participant.save(update_fields=["display_name", "kind", "user", "updated_at"])

    # Remove push credentials so no stale tokens survive.
    DeviceToken.objects.filter(user=actor).delete()
    WebPushSubscription.objects.filter(user=actor).delete()

    actor.delete()

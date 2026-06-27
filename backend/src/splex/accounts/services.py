import logging
from datetime import timedelta
from urllib.parse import urlencode

import requests as http_requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from splex.accounts.email_copy import build_email_content
from splex.accounts.models import MagicLoginChallenge
from splex.notifications.models import DeviceToken, WebPushSubscription
from splex.participants.services import get_or_create_user_participant
from splex.shared.errors import DomainError, ErrorCode

logger = logging.getLogger(__name__)

MAGIC_LOGIN_VALID_MINUTES = 15

# Accepted issuers for a Google ID token's ``iss`` claim.
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


def _magic_link_daily_limit_reached(email: str) -> bool:
    """True if ``email`` has already hit the per-recipient 24 h send cap.

    The DRF throttle limits requests per source IP; this limit protects a
    targeted recipient address from being email-bombed across many IPs and
    stops the server being used as an open relay for a single address.
    """
    limit = getattr(settings, "MAGIC_LINK_MAX_EMAILS_PER_DAY", 0)
    if limit <= 0:
        return False
    since = timezone.now() - timedelta(days=1)
    sent_today = MagicLoginChallenge.objects.filter(
        email=email,
        created_at__gte=since,
    ).count()
    return sent_today >= limit


def _build_template_email(*, recipient, template_base, context, locale):
    """Render a paired .txt + .html template and dispatch as a multipart email."""
    email_context = dict(context)
    email_context.update(build_email_content(template_base, locale, context))
    text_body = render_to_string(f"emails/{template_base}.txt", email_context)
    html_body = render_to_string(f"emails/{template_base}.html", email_context)
    message = EmailMultiAlternatives(
        subject=email_context['subject'],
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient],
    )
    message.attach_alternative(html_body, "text/html")
    return message


def _send_template_email(*, recipient, template_base, context, locale):
    message = _build_template_email(
        recipient=recipient,
        template_base=template_base,
        context=context,
        locale=locale,
    )
    message.send(fail_silently=False)


def request_magic_login(email: str, invite_token: str = "", locale: str = ""):
    email = email.strip().lower()
    if _magic_link_daily_limit_reached(email):
        # Silently stop sending once the recipient's daily cap is hit.  The view
        # always reports "sent" regardless, so this neither leaks the limit nor
        # whether the address exists.
        logger.info("Magic-link daily send limit reached for a recipient; suppressing email.")
        return None
    user_locale = locale.strip()
    existing_user = get_user_model().objects.filter(email=email).only('locale').first()
    if not user_locale and existing_user is not None:
        user_locale = existing_user.locale or ''
    with transaction.atomic():
        MagicLoginChallenge.objects.filter(
            email=email,
            consumed_at__isnull=True,
        ).update(consumed_at=timezone.now())
        challenge, code, token = MagicLoginChallenge.create(email)
    query = {"token": token}
    if invite_token:
        query["inviteToken"] = invite_token
    magic_url = f"{settings.APP_PUBLIC_URL}/login/magic?{urlencode(query)}"
    _send_template_email(
        recipient=email,
        template_base="magic_login",
        context={
            "code": code,
            "magic_url": magic_url,
            "minutes_valid": MAGIC_LOGIN_VALID_MINUTES,
        },
        locale=user_locale,
    )
    return challenge


def authenticate_magic_code(email: str, code: str):
    # The raise on the failure path happens *outside* the atomic block on
    # purpose: a wrong-code attempt must increment failed_attempts (and possibly
    # burn the challenge) durably, so that write can't be rolled back by the
    # exception we then raise to the caller.
    with transaction.atomic():
        challenge = (
            MagicLoginChallenge.objects.select_for_update()
            .filter(email=email.strip().lower())
            .order_by("-created_at")
            .first()
        )
        if challenge and challenge.is_valid() and challenge.verify_code(code):
            return consume_challenge(challenge)
        if challenge is not None and challenge.is_valid():
            _record_failed_code_attempt(challenge)
    raise DomainError(
        ErrorCode.AUTH_LOGIN_CODE_INVALID,
        "Invalid or expired login code.",
    )


def _record_failed_code_attempt(challenge) -> None:
    """Count a wrong code guess and burn the challenge once the cap is hit."""
    challenge.failed_attempts += 1
    update_fields = ["failed_attempts"]
    max_attempts = getattr(settings, "MAGIC_CODE_MAX_ATTEMPTS", 0)
    if max_attempts > 0 and challenge.failed_attempts >= max_attempts:
        # Burn the challenge so further guesses (even with the right code) are
        # rejected; the user must request a fresh code.
        challenge.consumed_at = timezone.now()
        update_fields.append("consumed_at")
    challenge.save(update_fields=update_fields)


@transaction.atomic
def authenticate_magic_token(token: str):
    token_hash = MagicLoginChallenge.hash_token(token)
    challenge = (
        MagicLoginChallenge.objects.select_for_update().filter(token_hash=token_hash).first()
    )
    if not challenge or not challenge.is_valid():
        raise DomainError(
            ErrorCode.AUTH_LOGIN_TOKEN_INVALID,
            "Invalid or expired login token.",
        )
    return consume_challenge(challenge)


def record_login_activity(user) -> None:
    """Update last_login and clear any pending retention warning flags."""
    now = timezone.now()
    user.last_login = now
    user.retention_first_notice_sent_at = None
    user.retention_second_notice_sent_at = None
    user.save(
        update_fields=[
            "last_login",
            "retention_first_notice_sent_at",
            "retention_second_notice_sent_at",
        ]
    )


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
        raise DomainError(ErrorCode.AUTH_GOOGLE_FAILED, "Google login is not configured.")

    try:
        resp = http_requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
            timeout=10,
        )
        resp.raise_for_status()
        payload = resp.json()
    except Exception as exc:
        raise DomainError(ErrorCode.AUTH_GOOGLE_FAILED, "Could not verify Google token.") from exc

    if payload.get("iss") not in GOOGLE_ISSUERS:
        raise DomainError(ErrorCode.AUTH_GOOGLE_FAILED, "Token issuer is not Google.")

    if payload.get("aud") not in allowed_client_ids:
        raise DomainError(
            ErrorCode.AUTH_GOOGLE_FAILED,
            "Token audience does not match configured client IDs.",
        )

    if payload.get("email_verified") not in (True, "true"):
        raise DomainError(ErrorCode.AUTH_GOOGLE_FAILED, "Google account email is not verified.")

    email = payload.get("email", "").strip().lower()
    if not email:
        raise DomainError(ErrorCode.AUTH_GOOGLE_FAILED, "No email address in Google token.")

    user_model = get_user_model()
    if not settings.ALLOW_REGISTRATION:
        try:
            user = user_model.objects.get(email=email)
            created = False
        except user_model.DoesNotExist:
            raise DomainError(
                ErrorCode.AUTH_REGISTRATION_DISABLED,
                "Registration is disabled on this server.",
            )
    else:
        user, created = user_model.objects.get_or_create(
            email=email,
            defaults={"display_name": payload.get("name", email.split("@")[0])},
        )
    get_or_create_user_participant(user)
    record_login_activity(user)
    refresh = RefreshToken.for_user(user)
    return user, {"access": str(refresh.access_token), "refresh": str(refresh), "created": created}


def consume_challenge(challenge):
    user_model = get_user_model()
    if not settings.ALLOW_REGISTRATION:
        try:
            user = user_model.objects.get(email=challenge.email)
            created = False
        except user_model.DoesNotExist:
            raise DomainError(
                ErrorCode.AUTH_REGISTRATION_DISABLED,
                "Registration is disabled on this server.",
            )
    else:
        user, created = user_model.objects.get_or_create(
            email=challenge.email,
            defaults={"display_name": challenge.email.split("@")[0]},
        )
    get_or_create_user_participant(user)
    challenge.consumed_at = timezone.now()
    challenge.save(update_fields=["consumed_at"])
    record_login_activity(user)
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
                recipient=email,
                template_base="account_deleted",
                context={
                    "email": email,
                    "display_name": display_name,
                    "frontend_url": settings.APP_PUBLIC_URL,
                },
                locale=actor.locale,
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
    from django.db.models import Q

    from splex.groups.models import GroupMembership
    from splex.groups.services import _convert_participant_in_group, delete_group
    from splex.invitations.models import Invitation

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
            # Last registered member abandons the group: any remaining balances
            # are with unregistered placeholders, so (like leave_group) we don't
            # force a settle-up — otherwise account deletion would fail outright.
            delete_group(actor=actor, group=group, require_settled=False)

    # Snapshot name on the original participant so friend-context data stays readable.
    participant.display_name = display_name
    participant.kind = participant.Kind.UNREGISTERED
    participant.user = None
    participant.save(update_fields=["display_name", "kind", "user", "updated_at"])

    # Remove push credentials so no stale tokens survive.
    DeviceToken.objects.filter(user=actor).delete()
    WebPushSubscription.objects.filter(user=actor).delete()

    # Invitations are ephemeral tokens with PROTECT links to the user (both
    # invited_by and accepted_by); delete any referencing the actor so the
    # User row can be removed without a ProtectedError.
    Invitation.objects.filter(Q(invited_by=actor) | Q(accepted_by=actor)).delete()

    # Remove the uploaded profile picture so the blob doesn't outlive the account.
    from splex.shared.uploads import delete_stored_image

    delete_stored_image(actor.avatar_url)

    actor.delete()

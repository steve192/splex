from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from splex.accounts.models import MagicLoginChallenge
from splex.participants.services import get_or_create_user_participant


def request_magic_login(email: str, invite_token: str = ""):
    email = email.strip().lower()
    challenge, code, token = MagicLoginChallenge.create(email)
    query = {"token": token}
    if invite_token:
        query["inviteToken"] = invite_token
    magic_url = f"{settings.FRONTEND_PUBLIC_URL}/login/magic?{urlencode(query)}"
    send_mail(
        subject="Your Splex login code",
        message=f"Use code {code} or open {magic_url}",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )
    return challenge


@transaction.atomic
def authenticate_magic_code(email: str, code: str):
    challenge = (
        MagicLoginChallenge.objects.filter(email=email.strip().lower())
        .order_by("-created_at")
        .first()
    )
    if not challenge or not challenge.is_valid() or not challenge.verify_code(code):
        raise ValueError("Invalid or expired login code.")
    return consume_challenge(challenge)


@transaction.atomic
def authenticate_magic_token(token: str):
    token_hash = MagicLoginChallenge.hash_token(token)
    challenge = MagicLoginChallenge.objects.filter(token_hash=token_hash).first()
    if not challenge or not challenge.is_valid():
        raise ValueError("Invalid or expired login token.")
    return consume_challenge(challenge)


def consume_challenge(challenge):
    User = get_user_model()
    user, created = User.objects.get_or_create(
        email=challenge.email,
        defaults={"display_name": challenge.email.split("@")[0]},
    )
    get_or_create_user_participant(user)
    challenge.consumed_at = timezone.now()
    challenge.save(update_fields=["consumed_at"])
    refresh = RefreshToken.for_user(user)
    return user, {"access": str(refresh.access_token), "refresh": str(refresh), "created": created}

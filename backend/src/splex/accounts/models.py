import hashlib
import secrets
from datetime import timedelta

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=150, blank=True)
    default_currency = models.CharField(max_length=3, default="EUR")
    avatar_url = models.URLField(blank=True)
    avatar_attribution = models.TextField(blank=True)
    push_enabled = models.BooleanField(default=True)
    locale = models.CharField(max_length=8, default="en")
    location_tracking_enabled = models.BooleanField(default=True)

    # Data-retention tracking: timestamps are set when each warning email is sent and
    # cleared when the user logs in again so the cycle resets after re-activation.
    retention_first_notice_sent_at = models.DateTimeField(null=True, blank=True)
    retention_second_notice_sent_at = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self) -> str:
        return self.display_name or self.email


class PaymentMethod(models.Model):
    """A payment destination a user is willing to be paid through.

    Today the only supported kind is PayPal, stored as either a paypal.me
    handle (clickable link) or an email address (best-effort: payer copies it
    into PayPal's send-money page).  The model is intentionally generic so
    other payment kinds (e.g. SEPA IBAN, Revolut) can be added later without
    a schema migration beyond extending the ``Kind`` choices.

    Exactly one payment method per user can carry ``is_preferred=True`` at a
    time - that invariant is enforced at the service layer; the index just
    makes the "current preferred" lookup constant-time.
    """

    class Kind(models.TextChoices):
        PAYPAL_HANDLE = "paypal_handle", "PayPal handle"
        PAYPAL_EMAIL = "paypal_email", "PayPal email"

    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="payment_methods"
    )
    kind = models.CharField(max_length=32, choices=Kind.choices)
    # Normalized identifier.  For PAYPAL_HANDLE this is the bare username
    # (e.g. "alice123"), stripped of any "paypal.me/" prefix or leading "@".
    # For PAYPAL_EMAIL it is the canonical lower-cased email address.
    identifier = models.CharField(max_length=254)
    is_preferred = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_preferred", "created_at"]
        indexes = [
            models.Index(
                fields=["user", "is_preferred"],
                name="payment_user_preferred_idx",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "kind", "identifier"],
                name="payment_unique_per_kind_identifier",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.get_kind_display()}: {self.identifier}"


class MagicLoginChallenge(models.Model):
    email = models.EmailField()
    code_hash = models.CharField(max_length=128)
    token_hash = models.CharField(max_length=128, unique=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    # Number of wrong code submissions against this challenge.  Once it reaches
    # settings.MAGIC_CODE_MAX_ATTEMPTS the challenge is invalidated to stop
    # brute force of the 6-digit code (see authenticate_magic_code).
    failed_attempts = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def create(cls, email: str):
        email = email.strip().lower()
        code = f"{secrets.randbelow(1_000_000):06d}"
        token = secrets.token_urlsafe(32)
        challenge = cls.objects.create(
            email=email,
            code_hash=hashlib.sha256(code.encode()).hexdigest(),
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
            expires_at=timezone.now() + timedelta(minutes=15),
        )
        return challenge, code, token

    def is_valid(self) -> bool:
        return self.consumed_at is None and self.expires_at > timezone.now()

    def verify_code(self, code: str) -> bool:
        # Constant-time compare so a wrong guess can't be distinguished from the
        # hash-comparison timing (both operands are fixed-length hex digests).
        candidate = hashlib.sha256(code.encode()).hexdigest()
        return secrets.compare_digest(self.code_hash, candidate)

    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

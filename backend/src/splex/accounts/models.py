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


class MagicLoginChallenge(models.Model):
    email = models.EmailField()
    code_hash = models.CharField(max_length=128)
    token_hash = models.CharField(max_length=128, unique=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
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
        return self.code_hash == hashlib.sha256(code.encode()).hexdigest()

    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

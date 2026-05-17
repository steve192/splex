import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


class Invitation(models.Model):
    class Type(models.TextChoices):
        GROUP_JOIN = "group_join", "Group join"
        FRIEND_JOIN = "friend_join", "Friend join"
        CLAIM_PARTICIPANT = "claim_participant", "Claim participant"

    token_hash = models.CharField(max_length=128, unique=True)
    type = models.CharField(max_length=32, choices=Type.choices)
    group = models.ForeignKey("groups.Group", null=True, blank=True, on_delete=models.CASCADE)
    target_participant = models.ForeignKey(
        "participants.Participant", null=True, blank=True, on_delete=models.CASCADE
    )
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="accepted_invitations",
    )
    expires_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def create_with_token(cls, **kwargs):
        token = secrets.token_urlsafe(32)
        kwargs.setdefault("expires_at", timezone.now() + timedelta(days=30))
        invitation = cls.objects.create(token_hash=cls.hash_token(token), **kwargs)
        return invitation, token

    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    def is_valid(self) -> bool:
        if self.accepted_at or self.revoked_at:
            return False
        return self.expires_at is None or self.expires_at > timezone.now()


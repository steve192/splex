from django.conf import settings
from django.db import models

from splex.shared.managers import SoftDeletableManager
from splex.shared.models import TimeStampedModel


class Group(TimeStampedModel):
    # `archived_at` is a separate user-controlled state (still browseable) so
    # only `deleted_at` qualifies as "gone".
    SOFT_DELETE_FIELD = "deleted_at"

    name = models.CharField(max_length=180)
    icon_url = models.URLField(blank=True)
    default_currency = models.CharField(max_length=3, default="EUR")
    default_split_method = models.CharField(max_length=40, default="equal_all")
    default_split_payload = models.JSONField(default=dict, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )

    objects = SoftDeletableManager()

    def __str__(self) -> str:
        return self.name


class GroupMembership(models.Model):
    SOFT_DELETE_FIELD = "removed_at"

    class Role(models.TextChoices):
        MEMBER = "member", "Member"
        ADMIN = "admin", "Admin"

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="memberships")
    participant = models.ForeignKey(
        "participants.Participant", on_delete=models.CASCADE, related_name="group_memberships"
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)
    removed_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeletableManager()

    class Meta:
        unique_together = [("group", "participant")]

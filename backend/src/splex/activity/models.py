from django.conf import settings
from django.db import models


class ActivityEvent(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    event_type = models.CharField(max_length=80)
    # SET_NULL (not CASCADE): when a group/friendship is purged after the data
    # retention window, its activity events survive as context-less history
    # rather than being deleted along with it.
    group = models.ForeignKey("groups.Group", null=True, blank=True, on_delete=models.SET_NULL)
    friendship = models.ForeignKey(
        "friends.Friendship", null=True, blank=True, on_delete=models.SET_NULL
    )
    expense = models.ForeignKey(
        "expenses.Expense", null=True, blank=True, on_delete=models.SET_NULL
    )
    settlement = models.ForeignKey(
        "settlements.Settlement", null=True, blank=True, on_delete=models.SET_NULL
    )
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


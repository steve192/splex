from django.conf import settings
from django.db import models


class ClientMutation(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSED = "processed", "Processed"
        FAILED = "failed", "Failed"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    client_mutation_id = models.CharField(max_length=80)
    mutation_type = models.CharField(max_length=80)
    request_payload = models.JSONField(default=dict)
    response_payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("user", "client_mutation_id")]


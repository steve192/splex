from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class PeriodicTask(models.Model):
    """Database-backed run-timestamp and lock for background periodic tasks.

    Each named task has exactly one row.  Workers race to claim a slot by
    atomically updating the row when it is stale enough; the one that wins
    the race runs the task while the others skip it.
    """

    name = models.CharField(max_length=100, unique=True)
    last_run_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"PeriodicTask({self.name}, last_run_at={self.last_run_at})"


"""Background scheduler for periodic server-side tasks.

A single daemon thread is started per gunicorn worker process when the server
boots (via SharedConfig.ready()).  The thread wakes up every hour and checks
whether any task is due.  A database-level race (atomic UPDATE on a stale row)
ensures that only one worker actually executes each task when multiple workers
are running.

Adding a new periodic task
---------------------------
1.  Write a management command (or any callable that is safe to call from a
    background thread).
2.  Add an entry to ``_TASKS`` below with the command name and the minimum
    number of hours between runs.
"""

import logging
import time
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

logger = logging.getLogger(__name__)

# How often the scheduler thread wakes up to check for due tasks.
_CHECK_INTERVAL_SECONDS = 3600  # 1 hour

# How long to wait after process start before the first check.
# Gives the database connection pool and Django ORM time to settle.
_STARTUP_DELAY_SECONDS = 60

# Task registry: maps management-command name → minimum hours between runs.
_TASKS: dict[str, int] = {
    "check_expo_receipts": 1,
    "cleanup_links": 23,
    "cleanup_push_endpoints": 23,
    "cleanup_receipts": 23,
    "enforce_data_retention": 23,
    "purge_soft_deleted": 23,
}


def _try_claim_task(name: str, interval_hours: int) -> bool:
    """Atomically claim a task run slot.

    Returns True if this worker won the race and should run the task.
    Returns False if another worker ran it recently or won the race.
    """
    from splex.shared.models import PeriodicTask

    cutoff = timezone.now() - timedelta(hours=interval_hours)
    try:
        with transaction.atomic():
            # Fast path: update an existing row that is old enough.
            updated = PeriodicTask.objects.filter(
                name=name,
            ).filter(
                Q(last_run_at__isnull=True) | Q(last_run_at__lt=cutoff)
            ).update(last_run_at=timezone.now())

            if updated:
                return True

            # Slow path: row does not exist yet - create it.
            # If two workers race here, one gets IntegrityError (unique name)
            # and returns False; the winner returns True.
            try:
                PeriodicTask.objects.create(name=name, last_run_at=timezone.now())
                return True
            except IntegrityError:
                # The row was just created by another worker and is not stale.
                return False
    except Exception:
        logger.exception("Failed to claim periodic task slot for '%s'", name)
        return False


def _run_task(name: str) -> None:
    from django.core.management import call_command

    logger.info("Running scheduled task: %s", name)
    try:
        call_command(name)
        logger.info("Scheduled task completed: %s", name)
    except Exception:
        logger.exception("Scheduled task failed: %s", name)


def _scheduler_loop() -> None:
    """Main body of the background scheduler thread."""
    time.sleep(_STARTUP_DELAY_SECONDS)
    logger.info("Background scheduler ready")

    while True:
        for task_name, interval_hours in _TASKS.items():
            try:
                if _try_claim_task(task_name, interval_hours):
                    _run_task(task_name)
            except Exception:
                logger.exception("Scheduler error for task '%s'", task_name)

        time.sleep(_CHECK_INTERVAL_SECONDS)


def start_background_scheduler() -> None:
    """Start the background scheduler daemon thread.

    Safe to call multiple times - each call starts one thread, but the DB
    lock inside the loop prevents duplicate task runs across workers.
    """
    import threading

    thread = threading.Thread(
        target=_scheduler_loop,
        name="splex-scheduler",
        daemon=True,  # thread dies automatically when the main process exits
    )
    thread.start()
    logger.info("Background scheduler thread started")

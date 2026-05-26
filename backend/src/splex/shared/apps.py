import os
import sys

from django.apps import AppConfig


class SharedConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "splex.shared"
    label = "shared"

    def ready(self):
        """Start the background scheduler when running under a server process.

        Skipped during:
        - pytest / unit tests  (``pytest`` present in ``sys.modules``)
        - ``manage.py`` invocations  (management commands, migrations, etc.)
        - Django's auto-reloader first pass  (``RUN_MAIN`` not set by reloader)

        Each gunicorn worker calls ready() independently after fork, so the
        scheduler thread is started per-worker.  The DB-level lock inside the
        scheduler guarantees that only one worker actually executes each task.
        """
        # Suppress during tests.
        if "pytest" in sys.modules:
            return

        # Suppress during manage.py invocations (migrations, management
        # commands, collectstatic, …).  Gunicorn is never launched via
        # manage.py, so this is a reliable discriminator.
        script = os.path.basename(sys.argv[0]) if sys.argv else ""
        if script == "manage.py":
            return

        from splex.shared.scheduler import start_background_scheduler

        start_background_scheduler()

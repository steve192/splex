from .base import *  # noqa: F403

DEBUG = False
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Risky-import endpoints are off by default in production but the import tests
# need them on; individual tests still exercise the off path with
# ``@override_settings(ENABLE_RISKY_IMPORTS=False)``.
ENABLE_RISKY_IMPORTS = True


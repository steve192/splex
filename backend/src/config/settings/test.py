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

# DRF throttle counters share a process-level cache.  In production they reset
# each minute, but the test runner fires many requests per second through the
# same scope, which trips the per-minute limits and flakes unrelated tests.
# Disable scoped throttling entirely under the test settings; the throttle
# logic itself is exercised in dedicated tests that opt back in if needed.
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = dict.fromkeys(  # noqa: F405
    REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],  # noqa: F405
    "1000000/minute",
)


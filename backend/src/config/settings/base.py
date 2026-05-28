import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[3]
load_dotenv(BASE_DIR.parent / ".env")


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value is None:
        return default
    return int(value)


def env_list(name: str, default=None):
    raw = os.environ.get(name)
    if raw is None:
        return list(default or [])
    return [item.strip() for item in raw.split(",") if item.strip()]


def public_origin(url: str) -> str:
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return ""
    return f"{parsed.scheme}://{parsed.netloc}"


def public_host(url: str) -> str:
    return urlparse(url).hostname or ""


DEFAULT_INSECURE_SECRET_KEY = "development-only-secret-key-for-local-use"
SECRET_KEY = env("SECRET_KEY", DEFAULT_INSECURE_SECRET_KEY)
DEBUG = env_bool("DEBUG", False)
if (
    not DEBUG
    and SECRET_KEY == DEFAULT_INSECURE_SECRET_KEY
    and not env("DJANGO_SETTINGS_MODULE").endswith((".local", ".test"))
):
    raise ImproperlyConfigured("SECRET_KEY must be set to a unique production value.")

FRONTEND_PUBLIC_URL = env("FRONTEND_PUBLIC_URL", "http://localhost:8000")
BACKEND_PUBLIC_URL = env("BACKEND_PUBLIC_URL", "http://localhost:8000")
PUBLIC_ORIGINS = sorted(
    {
        origin
        for origin in [public_origin(FRONTEND_PUBLIC_URL), public_origin(BACKEND_PUBLIC_URL)]
        if origin
    }
)
PUBLIC_HOSTS = sorted(
    {host for host in [public_host(FRONTEND_PUBLIC_URL), public_host(BACKEND_PUBLIC_URL)] if host}
)
DEFAULT_ALLOWED_HOSTS = [*PUBLIC_HOSTS, *(["localhost", "127.0.0.1"] if DEBUG else [])]
ALLOWED_HOSTS = env_list(
    "ALLOWED_HOSTS",
    DEFAULT_ALLOWED_HOSTS,
)
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", PUBLIC_ORIGINS)
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", PUBLIC_ORIGINS)
CORS_ALLOW_ALL_ORIGINS = env_bool("CORS_ALLOW_ALL_ORIGINS", False)
SERVE_PWA = env_bool("SERVE_PWA", True)
ENABLE_ADMIN_UI = env_bool("ENABLE_ADMIN_UI", DEBUG)
PWA_ROOT = BASE_DIR / "static_pwa"

APP_BEHIND_PROXY = env_bool("APP_BEHIND_PROXY", False)
PROXY_USES_TLS = env_bool("PROXY_USES_TLS", False)
PUBLIC_USES_TLS = (
    FRONTEND_PUBLIC_URL.startswith("https://")
    or BACKEND_PUBLIC_URL.startswith("https://")
    or PROXY_USES_TLS
)
SECURE_SSL_REDIRECT = PUBLIC_USES_TLS
SECURE_PROXY_SSL_HEADER = (
    ("HTTP_X_FORWARDED_PROTO", "https") if APP_BEHIND_PROXY and PROXY_USES_TLS else None
)
SECURE_HSTS_SECONDS = 31536000 if PUBLIC_USES_TLS else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = PUBLIC_USES_TLS
SECURE_HSTS_PRELOAD = PUBLIC_USES_TLS
SESSION_COOKIE_SECURE = PUBLIC_USES_TLS
CSRF_COOKIE_SECURE = PUBLIC_USES_TLS
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "same-origin"
PRIVATE_MEDIA_URL_MAX_AGE_SECONDS = env_int("PRIVATE_MEDIA_URL_MAX_AGE_SECONDS", 3600)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "splex.accounts",
    "splex.participants",
    "splex.groups",
    "splex.friends",
    "splex.invitations",
    "splex.expenses",
    "splex.settlements",
    "splex.balances",
    "splex.activity",
    "splex.notifications",
    "splex.currency",
    "splex.sync",
    "splex.shared",
    "splex.imports",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    # WhiteNoise serves Django admin's static files (and any other STATIC_ROOT
    # content) so /admin/ doesn't render unstyled. Must come right after
    # SecurityMiddleware per WhiteNoise docs.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "static_pwa"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

SQLITE_PATH = env("SQLITE_PATH", str(BASE_DIR.parent / "data" / "splex.sqlite3"))
DATABASE_URL = env("DATABASE_URL")
if DATABASE_URL:
    DATABASES = {"default": dj_database_url.parse(DATABASE_URL, conn_max_age=600)}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": SQLITE_PATH,
        }
    }

AUTH_USER_MODEL = "accounts.User"

LANGUAGE_CODE = "en"
LANGUAGES = [("en", "English"), ("de", "Deutsch")]
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(env("MEDIA_ROOT", str(BASE_DIR.parent / "data" / "media")))
TOS_FILE_PATH = Path(env("TOS_FILE_PATH", "/app/data/tos.html"))
PRIVACY_FILE_PATH = Path(env("PRIVACY_FILE_PATH", "/app/data/privacy.html"))
IMPRINT_FILE_PATH = Path(env("IMPRINT_FILE_PATH", "/app/data/imprint.html"))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": env("THROTTLE_ANON_RATE", "120/minute"),
        "user": env("THROTTLE_USER_RATE", "600/minute"),
        "magic_link": env("THROTTLE_MAGIC_LINK_RATE", "5/minute"),
        "magic_code": env("THROTTLE_MAGIC_CODE_RATE", "20/minute"),
        "magic_token": env("THROTTLE_MAGIC_TOKEN_RATE", "20/minute"),
        "invitation_preview": env("THROTTLE_INVITATION_PREVIEW_RATE", "60/minute"),
        "private_media": env("THROTTLE_PRIVATE_MEDIA_RATE", "120/minute"),
    },
    "EXCEPTION_HANDLER": "splex.shared.api.exception_handler",
}

ACCESS_TOKEN_LIFETIME_MINUTES = int(env("ACCESS_TOKEN_LIFETIME_MINUTES", "15"))
REFRESH_TOKEN_LIFETIME_DAYS = int(env("REFRESH_TOKEN_LIFETIME_DAYS", "180"))
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=ACCESS_TOKEN_LIFETIME_MINUTES),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=REFRESH_TOKEN_LIFETIME_DAYS),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    (
        "django.core.mail.backends.console.EmailBackend"
        if DEBUG
        else "django.core.mail.backends.smtp.EmailBackend"
    ),
)
EMAIL_HOST = env("EMAIL_HOST", "localhost")
EMAIL_PORT = int(env("EMAIL_PORT", "25"))
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", False)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "Splex <noreply@example.com>")

CURRENCY_RATE_PROVIDER = env("CURRENCY_RATE_PROVIDER", "placeholder")
CURRENCY_RATE_API_BASE_URL = env("CURRENCY_RATE_API_BASE_URL", "")
CURRENCY_RATE_API_KEY = env("CURRENCY_RATE_API_KEY", "")

VAPID_PUBLIC_KEY = env("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = env("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = env("VAPID_SUBJECT", f"mailto:{DEFAULT_FROM_EMAIL}")

# Allow new user accounts to be created at login.  When false, only existing
# users may sign in; unknown emails (magic link or Google) are rejected.
ALLOW_REGISTRATION = env_bool("ALLOW_REGISTRATION", True)

# Data retention: accounts that have not logged in for this many months are
# automatically deleted after two warning emails (14 days and 7 days before
# deletion).  Set to 0 to disable automatic deletion entirely.
# Enforced automatically every 24 h by the built-in background scheduler.
DATA_RETENTION_INACTIVE_MONTHS = env_int("DATA_RETENTION_INACTIVE_MONTHS", 6)

# Receipts: per-file size limit (bytes) for receipt uploads.  Files larger
# than this are rejected at upload time.  Defaults to 15 MiB.
# Set to 0 to disable the per-file limit (no upper bound).
RECEIPT_MAX_FILE_SIZE_BYTES = env_int("RECEIPT_MAX_FILE_SIZE_BYTES", 15 * 1024 * 1024)
# Maximum combined size (bytes) of all receipts within a single group.
# When a group reaches this quota new uploads are rejected.  Defaults to 100 MiB.
# Set to 0 to disable the per-group quota (unlimited storage per group).
RECEIPT_MAX_GROUP_TOTAL_BYTES = env_int("RECEIPT_MAX_GROUP_TOTAL_BYTES", 100 * 1024 * 1024)
# How long a "draft" receipt (uploaded but never attached to an expense) is
# kept before the cleanup job removes it.  Defaults to 24 hours.
# Set to 0 to disable the cleanup job entirely (drafts kept indefinitely).
RECEIPT_DRAFT_RETENTION_HOURS = env_int("RECEIPT_DRAFT_RETENTION_HOURS", 24)

# Google OAuth2 / OIDC login.
# Leave empty to disable the Google login option entirely.
# GOOGLE_CLIENT_ID      - the Web or iOS OAuth client ID used to verify tokens on the backend.
# GOOGLE_ANDROID_CLIENT_ID - Android OAuth client ID; also accepted as a valid token audience.
GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID", "")
GOOGLE_ANDROID_CLIENT_ID = env("GOOGLE_ANDROID_CLIENT_ID", "")

# Demo mode: when enabled, the login screen offers a "Try demo" button that
# runs the app against in-memory mock data without contacting the backend.
DEMO_MODE_ENABLED = env_bool("DEMO_MODE_ENABLED", False)

# "Risky" import sources are off by default.  These let the user point Splex
# at an arbitrary network endpoint (e.g. a Split Pro PostgreSQL database) from
# inside the server's network perimeter.  That can be abused to reach
# resources behind the firewall, and a malicious endpoint speaking the same
# wire protocol could exploit weaknesses in the client library, so operators
# have to opt-in explicitly.
ENABLE_RISKY_IMPORTS = env_bool("ENABLE_RISKY_IMPORTS", False)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
        },
    },
    "loggers": {
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
        "config.urls": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "splex.invitations": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "splex.sync": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

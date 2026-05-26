import importlib
import sys


def load_base_settings(monkeypatch, **env_overrides):
    monkeypatch.setenv("DJANGO_SETTINGS_MODULE", "config.settings.test")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("FRONTEND_PUBLIC_URL", "http://localhost:8000")
    monkeypatch.setenv("BACKEND_PUBLIC_URL", "http://localhost:8000")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("SQLITE_PATH", raising=False)
    for name, value in env_overrides.items():
        monkeypatch.setenv(name, value)

    sys.modules.pop("config.settings.base", None)
    importlib.invalidate_caches()
    return importlib.import_module("config.settings.base")


def test_base_settings_uses_sqlite_path_when_database_url_is_unset(monkeypatch):
    settings_module = load_base_settings(monkeypatch, SQLITE_PATH="/app/data/splex.sqlite3")

    assert settings_module.DATABASES["default"] == {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": "/app/data/splex.sqlite3",
    }


def test_base_settings_prefers_database_url_over_sqlite_path(monkeypatch):
    settings_module = load_base_settings(
        monkeypatch,
        SQLITE_PATH="/app/data/ignored.sqlite3",
        DATABASE_URL="postgres://splex:splex@postgres:5432/splex",
    )

    assert settings_module.DATABASES["default"]["ENGINE"] == "django.db.backends.postgresql"
    assert settings_module.DATABASES["default"]["NAME"] == "splex"
    assert settings_module.DATABASES["default"]["USER"] == "splex"
    assert settings_module.DATABASES["default"]["PASSWORD"] == "splex"
    assert settings_module.DATABASES["default"]["HOST"] == "postgres"
    assert settings_module.DATABASES["default"]["PORT"] == 5432
    assert settings_module.DATABASES["default"]["CONN_MAX_AGE"] == 600
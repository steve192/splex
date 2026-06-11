"""Routing for the marketing landing page and the app's move under /app.

The landing/app/redirect routes in ``config.urls`` are built conditionally from
settings at import time, so toggling ``SERVE_LANDING`` (or pointing the static
roots at a fixture directory) requires reloading the urlconf with the overrides
active.
"""

import importlib
from contextlib import contextmanager
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from django.conf import settings
from django.test import Client, override_settings
from django.urls import clear_url_caches

import config.urls


@contextmanager
def reloaded_urlconf():
    """Rebuild config.urls against the currently active settings, then restore."""
    clear_url_caches()
    importlib.reload(config.urls)
    try:
        yield
    finally:
        clear_url_caches()
        importlib.reload(config.urls)


@contextmanager
def app_static_root():
    """A temp PWA_ROOT laid out like an Expo /app export."""
    with TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / ".well-known").mkdir()
        (root / ".well-known" / "assetlinks.json").write_text("[]", encoding="utf-8")
        (root / "manifest.webmanifest").write_text("{}", encoding="utf-8")
        (root / "index.html").write_text("<!doctype html><title>app</title>", encoding="utf-8")
        with override_settings(PWA_ROOT=root, TEMPLATES=_templates_with_dir(root)):
            yield root


def _templates_with_dir(directory: Path):
    templates = [dict(engine) for engine in settings.TEMPLATES]
    templates[0]["DIRS"] = [directory]
    return templates


@pytest.mark.django_db
def test_assetlinks_served_from_domain_root():
    with app_static_root(), reloaded_urlconf():
        response = Client().get("/.well-known/assetlinks.json")
    assert response.status_code == 200


@pytest.mark.django_db
def test_app_assets_strip_the_base_path_prefix():
    with app_static_root(), reloaded_urlconf():
        response = Client().get("/app/manifest.webmanifest")
    assert response.status_code == 200


@pytest.mark.django_db
def test_app_deep_link_falls_back_to_spa_index():
    with app_static_root(), reloaded_urlconf():
        response = Client().get("/app/groups/42")
    assert response.status_code == 200
    assert b"<title>app</title>" in response.content


@pytest.mark.django_db
def test_robots_disallows_the_app_but_not_the_landing():
    with reloaded_urlconf():
        response = Client().get("/robots.txt")
    assert response.status_code == 200
    body = response.content.decode()
    assert "Disallow: /app/" in body


@pytest.mark.django_db
def test_root_serves_the_landing_when_enabled():
    with TemporaryDirectory() as tmp:
        landing = Path(tmp)
        (landing / "index.html").write_text("<h1>Splex landing</h1>", encoding="utf-8")
        with override_settings(SERVE_LANDING=True, LANDING_ROOT=landing), reloaded_urlconf():
            response = Client().get("/")
            assert response.status_code == 200
            # `serve` returns a streaming FileResponse.
            assert b"Splex landing" in b"".join(response.streaming_content)


@pytest.mark.django_db
def test_locale_directory_page_serves_its_index_html():
    # Astro emits the German locale as a directory page (de/index.html); a
    # request for /de/ must resolve to it, not fall back to the English root.
    with TemporaryDirectory() as tmp:
        landing = Path(tmp)
        (landing / "index.html").write_text("<h1>English</h1>", encoding="utf-8")
        (landing / "de").mkdir()
        (landing / "de" / "index.html").write_text("<h1>Deutsch</h1>", encoding="utf-8")
        with override_settings(SERVE_LANDING=True, LANDING_ROOT=landing), reloaded_urlconf():
            response = Client().get("/de/")
            assert response.status_code == 200
            assert b"Deutsch" in b"".join(response.streaming_content)


@pytest.mark.django_db
def test_root_redirects_to_app_when_landing_disabled():
    with override_settings(SERVE_LANDING=False), reloaded_urlconf():
        response = Client().get("/")
    assert response.status_code == 302
    assert response["Location"] == "/app/"


def test_app_public_url_points_user_links_at_the_app():
    from splex.invitations.services import invitation_url

    assert settings.APP_PUBLIC_URL == settings.FRONTEND_PUBLIC_URL.rstrip("/") + "/app"
    assert invitation_url("tok123") == f"{settings.APP_PUBLIC_URL}/invite/tok123"

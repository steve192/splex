from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from splex.shared.tos import (
    ensure_legal_file,
    get_legal_file_path,
    render_legal_document,
)


@pytest.mark.django_db
def test_public_tos_endpoint_serves_wrapped_html_without_authentication():
    with TemporaryDirectory() as temp_dir:
        tos_path = Path(temp_dir) / "tos.html"
        tos_path.write_text("<h2>House Rules</h2><p>Be kind.</p>", encoding="utf-8")

        with override_settings(TOS_FILE_PATH=tos_path):
            response = APIClient().get("/api/tos/", HTTP_ACCEPT="text/html")

        assert response.status_code == 200
        assert response["Content-Type"].startswith("text/html")
        body = response.content.decode("utf-8")
        assert "<h2>House Rules</h2>" in body
        assert "Terms of Service" in body
        assert "article" in body


@pytest.mark.django_db
def test_public_privacy_endpoint_serves_wrapped_html_without_authentication():
    with TemporaryDirectory() as temp_dir:
        privacy_path = Path(temp_dir) / "privacy.html"
        privacy_path.write_text("<h2>Privacy Rules</h2><p>We keep it small.</p>", encoding="utf-8")

        with override_settings(PRIVACY_FILE_PATH=privacy_path):
            response = APIClient().get("/api/privacy/", HTTP_ACCEPT="text/html")

        assert response.status_code == 200
        assert response["Content-Type"].startswith("text/html")
        body = response.content.decode("utf-8")
        assert "<h2>Privacy Rules</h2>" in body
        assert "Privacy Policy" in body


@pytest.mark.django_db
def test_public_imprint_endpoint_serves_wrapped_html_without_authentication():
    with TemporaryDirectory() as temp_dir:
        imprint_path = Path(temp_dir) / "imprint.html"
        imprint_path.write_text("<h2>Provider</h2><p>Operator details.</p>", encoding="utf-8")

        with override_settings(IMPRINT_FILE_PATH=imprint_path):
            response = APIClient().get("/api/imprint/", HTTP_ACCEPT="text/html")

        assert response.status_code == 200
        assert response["Content-Type"].startswith("text/html")
        body = response.content.decode("utf-8")
        assert "<h2>Provider</h2>" in body
        assert "Legal Notice" in body


@pytest.mark.django_db
def test_render_legal_document_creates_placeholder_for_missing_tos_file():
    with TemporaryDirectory() as temp_dir:
        tos_path = Path(temp_dir) / "custom" / "tos.html"

        with override_settings(TOS_FILE_PATH=tos_path):
            ensure_legal_file("tos")
            document = render_legal_document("tos")

        assert tos_path.exists()
        placeholder = tos_path.read_text(encoding="utf-8")
        assert "Docker compose example" in placeholder
        assert str(tos_path) in placeholder
        assert "Terms of Service" in document
        assert "Mount it into the container" in document


@pytest.mark.django_db
def test_render_legal_document_creates_placeholder_for_missing_privacy_file():
    with TemporaryDirectory() as temp_dir:
        privacy_path = Path(temp_dir) / "custom" / "privacy.html"

        with override_settings(PRIVACY_FILE_PATH=privacy_path):
            ensure_legal_file("privacy")
            document = render_legal_document("privacy")

        assert privacy_path.exists()
        placeholder = privacy_path.read_text(encoding="utf-8")
        assert "PRIVACY_FILE_PATH" in placeholder
        assert "Privacy Policy" in document


@pytest.mark.django_db
def test_render_legal_document_creates_placeholder_for_missing_imprint_file():
    with TemporaryDirectory() as temp_dir:
        imprint_path = Path(temp_dir) / "custom" / "imprint.html"

        with override_settings(IMPRINT_FILE_PATH=imprint_path):
            ensure_legal_file("imprint")
            document = render_legal_document("imprint")

        assert imprint_path.exists()
        placeholder = imprint_path.read_text(encoding="utf-8")
        assert "IMPRINT_FILE_PATH" in placeholder
        assert "Legal Notice" in document


def _set_unconfigured_settings(monkeypatch):
    monkeypatch.setattr(
        "splex.shared.tos.settings",
        type("SettingsStub", (), {"configured": False})(),
    )


def test_get_legal_file_path_uses_env_before_django_settings_for_tos(monkeypatch, tmp_path):
    fallback_path = str(tmp_path / "splex-tos.html")
    _set_unconfigured_settings(monkeypatch)
    monkeypatch.setenv("TOS_FILE_PATH", fallback_path)

    assert get_legal_file_path("tos") == Path(fallback_path)


def test_get_legal_file_path_uses_env_before_django_settings_for_privacy(monkeypatch, tmp_path):
    fallback_path = str(tmp_path / "splex-privacy.html")
    _set_unconfigured_settings(monkeypatch)
    monkeypatch.setenv("PRIVACY_FILE_PATH", fallback_path)

    assert get_legal_file_path("privacy") == Path(fallback_path)


def test_get_legal_file_path_uses_env_before_django_settings_for_imprint(monkeypatch, tmp_path):
    fallback_path = str(tmp_path / "splex-imprint.html")
    _set_unconfigured_settings(monkeypatch)
    monkeypatch.setenv("IMPRINT_FILE_PATH", fallback_path)

    assert get_legal_file_path("imprint") == Path(fallback_path)

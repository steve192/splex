from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from splex.shared.tos import (
    ensure_terms_of_service_file,
    get_tos_file_path,
    render_terms_of_service_document,
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
def test_render_terms_of_service_document_creates_placeholder_for_missing_file():
    with TemporaryDirectory() as temp_dir:
        tos_path = Path(temp_dir) / "custom" / "tos.html"

        with override_settings(TOS_FILE_PATH=tos_path):
            ensure_terms_of_service_file()
            document = render_terms_of_service_document()

        assert tos_path.exists()
        placeholder = tos_path.read_text(encoding="utf-8")
        assert "Docker compose example" in placeholder
        assert str(tos_path) in placeholder
        assert "Terms of Service" in document
        assert "Mount it into the container" in document


def test_get_tos_file_path_uses_env_before_django_settings(monkeypatch):
    fallback_path = "/tmp/splex-tos.html"
    monkeypatch.setattr("splex.shared.tos.settings", type("SettingsStub", (), {"configured": False})())
    monkeypatch.setenv("TOS_FILE_PATH", fallback_path)

    assert get_tos_file_path() == Path(fallback_path)
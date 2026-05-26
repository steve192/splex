import json

from splex.shared import open_source


def test_load_frontend_components_falls_back_to_backend_bundle(tmp_path, monkeypatch):
    frontend_source = tmp_path / "frontend-open-source.json"
    backend_bundle = tmp_path / "backend-open-source.json"
    payload = {"components": [{"source": "frontend", "name": "react", "license": "MIT"}]}
    backend_bundle.write_text(json.dumps(payload), encoding="utf-8")

    monkeypatch.setattr(open_source, "FRONTEND_SOURCE_JSON_PATH", frontend_source)
    monkeypatch.setattr(open_source, "BACKEND_BUNDLED_FRONTEND_JSON_PATH", backend_bundle)

    assert open_source.load_frontend_components() == payload["components"]


def test_load_frontend_components_prefers_frontend_source(tmp_path, monkeypatch):
    frontend_source = tmp_path / "frontend-open-source.json"
    backend_bundle = tmp_path / "backend-open-source.json"
    frontend_payload = {"components": [{"source": "frontend", "name": "expo", "license": "MIT"}]}
    backend_payload = {"components": [{"source": "frontend", "name": "react", "license": "MIT"}]}
    frontend_source.write_text(json.dumps(frontend_payload), encoding="utf-8")
    backend_bundle.write_text(json.dumps(backend_payload), encoding="utf-8")

    monkeypatch.setattr(open_source, "FRONTEND_SOURCE_JSON_PATH", frontend_source)
    monkeypatch.setattr(open_source, "BACKEND_BUNDLED_FRONTEND_JSON_PATH", backend_bundle)

    assert open_source.load_frontend_components() == frontend_payload["components"]
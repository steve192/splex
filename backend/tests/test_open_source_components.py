import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_open_source_components_endpoint_returns_app_and_sections(monkeypatch):
    payload = {
        "generatedAt": "2026-05-26T00:00:00+00:00",
        "app": {
            "name": "Splex",
            "license": "Splex Non-Commercial Source License 1.0",
            "licenseText": "license body",
            "copyright": "Copyright (c) 2026 steve192",
            "thirdPartyNotice": "third-party notice",
        },
        "sections": [
            {
                "id": "frontend",
                "title": "Frontend",
                "components": [
                    {
                        "source": "frontend",
                        "name": "react",
                        "license": "MIT",
                        "homepage": "https://react.dev",
                        "author": "Meta",
                        "noticeText": "",
                        "licenseText": "MIT text",
                    }
                ],
            },
            {"id": "backend", "title": "Backend", "components": []},
        ],
    }
    monkeypatch.setattr("splex.shared.api_views.build_open_source_payload", lambda: payload)

    response = APIClient().get("/api/open-source-components/")

    assert response.status_code == 200
    assert response.json() == payload
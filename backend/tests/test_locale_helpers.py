import pytest

from splex.shared import frontend_i18n
from splex.shared.locale import normalize_locale


def test_normalize_locale_uses_supported_base_language():
    assert normalize_locale("de-AT") == "de"


def test_normalize_locale_falls_back_to_english_for_missing_locale():
    assert normalize_locale(None) == "en"


@pytest.mark.django_db
def test_lookup_frontend_translation_uses_locale_then_english_fallback(monkeypatch):
    translations = {
        "de": {"auth.title": "Anmelden"},
        "en": {"auth.title": "Sign in", "auth.subtitle": "Split expenses"},
    }

    monkeypatch.setattr(frontend_i18n, "_load_locale", lambda locale: translations.get(locale, {}))

    assert frontend_i18n.lookup_frontend_translation("auth.title", "de-AT") == "Anmelden"
    assert frontend_i18n.lookup_frontend_translation("auth.subtitle", "de-AT") == "Split expenses"
    assert frontend_i18n.lookup_frontend_translation("auth.missing", "de-AT") == "auth.missing"
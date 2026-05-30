from typing import Optional

from django.conf import settings


def normalize_locale(locale: Optional[str]) -> str:
    """Return a supported backend locale code, falling back to English.

    Users may carry locale tags such as ``de-AT`` or ``pt_BR`` while the backend
    translation tables are keyed by the base language codes from ``settings.LANGUAGES``.
    """

    supported = {code for code, _ in settings.LANGUAGES}
    if not locale:
        return "en"

    candidate = locale.strip().lower().replace("_", "-")
    if candidate in supported:
        return candidate

    base_locale = candidate.split("-", 1)[0]
    if base_locale in supported:
        return base_locale

    return "en"
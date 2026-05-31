import json
from functools import cache
from pathlib import Path

from splex.shared.locale import normalize_locale


def _locale_dirs() -> list[Path]:
    current = Path(__file__).resolve()
    bundled = current.parent / 'frontend_locales'
    repo_locales = current.parents[4] / 'frontend' / 'src' / 'shared' / 'i18n' / 'locales'
    return [bundled, repo_locales]


def _find_locale_file(locale: str) -> Path | None:
    file_name = f'{locale}.json'
    for directory in _locale_dirs():
        candidate = directory / file_name
        if candidate.exists():
            return candidate
    return None


@cache
def _load_locale(locale: str) -> dict[str, str]:
    locale_file = _find_locale_file(locale)
    if locale_file is None:
        return {}
    return json.loads(locale_file.read_text(encoding='utf-8'))


def lookup_frontend_translation(key: str, locale: str) -> str:
    normalized = normalize_locale(locale)
    localized = _load_locale(normalized)
    if key in localized:
        return localized[key]
    return _load_locale('en').get(key, key)
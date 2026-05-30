"""Push notification text rendering keyed by event_type and locale.

Most activity wording is shared with the frontend locale catalog so the activity feed
and OS-level push banners stay in sync. The backend only owns reminder copy and the
payload-specific detail formatting.
"""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path
from string import Formatter

from splex.shared.frontend_i18n import lookup_frontend_translation
from splex.shared.locale import normalize_locale

_NOTIFICATION_LOCALES_DIR = Path(__file__).resolve().parent / 'notification_locales'


@cache
def _load_reminder_locale(locale: str) -> dict[str, str]:
    locale_file = _NOTIFICATION_LOCALES_DIR / f'{locale}.json'
    if not locale_file.exists():
        return {}
    return json.loads(locale_file.read_text(encoding='utf-8'))


class _SafeDict(dict):
    def __missing__(self, key):
        return '{' + key + '}'


def _render(template: str, payload: dict) -> str:
    try:
        return Formatter().vformat(template, (), _SafeDict(payload or {}))
    except (KeyError, IndexError, ValueError):
        return template


def _compose_segments(*segments: str | None) -> str:
    return ' · '.join(segment for segment in segments if segment)


def _amount_segment(payload: dict) -> str | None:
    amount = payload.get('amount')
    currency = payload.get('currency')
    if amount and currency:
        return f'{amount} {currency}'
    return amount or currency or None


def _quoted_description(payload: dict) -> str | None:
    description = payload.get('description')
    if not description:
        return None
    return f'"{description}"'


def _activity_title(event_type: str, locale: str, payload: dict) -> str:
    template = lookup_frontend_translation(f'activity.{event_type}', locale)
    if template == f'activity.{event_type}':
        return event_type
    return _render(template, payload)


def _render_detail(event_type: str, payload: dict) -> str:
    context = payload.get('context')
    if event_type in {'expense.created', 'expense.updated'}:
        return _compose_segments(_quoted_description(payload), _amount_segment(payload), context)
    if event_type == 'expense.deleted':
        return _compose_segments(_quoted_description(payload), context)
    if event_type in {'settlement.created', 'settlement.updated'}:
        return _compose_segments(_amount_segment(payload), context)
    if event_type == 'settlement.deleted':
        return _compose_segments(context)
    if event_type.startswith('group.'):
        return _compose_segments(context)
    return ''


def _render_reminder(event_type: str, payload: dict, locale: str) -> tuple[str, str]:
    english = _load_reminder_locale('en')
    table = dict(english)
    table.update(_load_reminder_locale(locale))
    return 'Splex', _render(table.get(event_type, english[event_type]), payload)


def render_notification(event_type: str, payload: dict, locale: str) -> tuple[str, str]:
    """Return (title, body) for a notification, falling back to English."""
    normalized = normalize_locale(locale)
    if event_type.startswith('reminder.'):
        return _render_reminder(event_type, payload or {}, normalized)

    title = _activity_title(event_type, normalized, payload or {})
    body = _render_detail(event_type, payload or {})
    return title or event_type, body
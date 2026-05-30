import json
from datetime import date, datetime
from functools import cache
from pathlib import Path

from django.utils.formats import date_format
from django.utils.translation import override

from splex.shared.frontend_i18n import lookup_frontend_translation
from splex.shared.locale import normalize_locale

MAGIC_INSTRUCTIONS_KEY = 'magic.instructions'
MAGIC_EXPIRY_KEY = 'magic.expiry'
_EMAIL_LOCALES_DIR = Path(__file__).resolve().parent / 'email_locales'


@cache
def _load_locale(locale: str) -> dict[str, str]:
    locale_file = _EMAIL_LOCALES_DIR / f'{locale}.json'
    if not locale_file.exists():
        return {}
    return json.loads(locale_file.read_text(encoding='utf-8'))


def _format_date(value, locale: str) -> str:
    if value is None:
        return ''
    normalized = normalize_locale(locale)
    if isinstance(value, datetime):
        value = value.date()
    if not isinstance(value, date):
        return str(value)
    with override(normalized):
        return date_format(value, 'DATE_FORMAT', use_l10n=True)


def _copy(locale: str) -> dict[str, str]:
    normalized = normalize_locale(locale)
    copy = dict(_load_locale('en'))
    copy.update(_load_locale(normalized))
    return copy


def build_email_content(template_base: str, locale: str, context: dict) -> dict[str, str]:
    normalized = normalize_locale(locale)
    copy = _copy(normalized)
    formatted_context = dict(context)
    if 'deletion_date' in formatted_context:
        formatted_context['deletion_date'] = _format_date(
            formatted_context['deletion_date'], normalized
        )

    if 'magic_login' == template_base:
        subject = lookup_frontend_translation('auth.title', normalized)
        return {
            'subject': subject,
            'preheader': copy[MAGIC_INSTRUCTIONS_KEY],
            'heading': subject,
            'button_label': subject,
            'code_label': lookup_frontend_translation('auth.code', normalized),
            'instructions': copy[MAGIC_INSTRUCTIONS_KEY].format(**formatted_context),
            'expiry': copy[MAGIC_EXPIRY_KEY].format(**formatted_context),
            'footer_ignore': copy['footer_ignore'],
        }

    subject = copy[f'{template_base}.subject'].format(**formatted_context)
    return {
        'subject': subject,
        'preheader': copy[f'{template_base}.body'].format(**formatted_context),
        'heading': subject,
        'body': copy[f'{template_base}.body'].format(**formatted_context),
        'history': copy.get(f'{template_base}.history', '').format(**formatted_context),
        'recreate': copy.get(f'{template_base}.recreate', '').format(**formatted_context),
        'unexpected': copy.get(f'{template_base}.unexpected', '').format(**formatted_context),
        'date_line': copy.get(f'{template_base}.date', '').format(**formatted_context),
        'cta': copy.get(f'{template_base}.cta', '').format(**formatted_context),
        'summary': copy.get(f'{template_base}.summary', '').format(**formatted_context),
        'immediate': copy.get(f'{template_base}.immediate', '').format(**formatted_context),
        'footer_ignore': copy['footer_ignore'],
    }
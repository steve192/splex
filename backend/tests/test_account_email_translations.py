from datetime import date

import pytest
from django.core import mail

from splex.accounts.email_copy import build_email_content
from splex.accounts.services import delete_account


def test_build_email_content_localizes_retention_warning_date_and_subject():
    content = build_email_content(
        'retention_warning',
        'de',
        {
            'email': 'max@example.com',
            'deletion_date': date(2026, 5, 30),
            'frontend_url': 'https://example.com',
        },
    )

    assert content['subject'] == 'Dein Splex-Konto wird bald gelöscht'
    assert content['date_line'] == 'Löschdatum: 30. Mai 2026'
    assert content['cta'] == 'Anmelden, um mein Konto zu behalten'


def test_build_email_content_uses_requested_locale_for_account_deleted_copy():
    content = build_email_content(
        'account_deleted',
        'es',
        {
            'email': 'ana@example.com',
            'frontend_url': 'https://example.com',
        },
    )

    assert content['subject'] == 'Tu cuenta de Splex ha sido eliminada'
    assert 'de forma permanente' in content['body']
    assert content['footer_ignore'] == 'Si no fuiste tú, puedes ignorar este correo.'


def test_build_email_content_falls_back_to_english_for_unknown_locale():
    content = build_email_content(
        'retention_warning',
        'zz',
        {
            'email': 'max@example.com',
            'deletion_date': date(2026, 5, 30),
            'frontend_url': 'https://example.com',
        },
    )

    assert content['subject'] == 'Your Splex account will be deleted soon'
    assert content['date_line'] == 'Deletion date: May 30, 2026'
    assert content['cta'] == 'Log in to keep my account'


@pytest.mark.django_db
def test_delete_account_sends_localized_email_for_user_locale(django_user_model):
    user = django_user_model.objects.create_user(
        email='hans@example.com',
        display_name='Hans',
        locale='de',
    )

    delete_account(actor=user)

    message = mail.outbox[-1]
    assert message.subject == 'Dein Splex-Konto wurde gelöscht'
    assert 'dauerhaft gelöscht' in message.body
    assert 'Wenn du diese Löschung nicht angefordert hast' in message.body
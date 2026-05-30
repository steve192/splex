from splex.notifications.translations import render_notification


def test_renders_english_template_with_placeholders():
    title, body = render_notification(
        'expense.created',
        {
            'actor': 'Alice',
            'context': 'Trip',
            'description': 'Pizza',
            'amount': '10.00',
            'currency': 'EUR',
        },
        'en',
    )
    assert title == 'Alice added an expense'
    assert 'Pizza' in body
    assert '10.00 EUR' in body
    assert 'Trip' in body


def test_renders_german_template():
    title, body = render_notification(
        'expense.created',
        {
            'actor': 'Bob',
            'context': 'WG',
            'description': 'Kaffee',
            'amount': '3.00',
            'currency': 'EUR',
        },
        'de',
    )
    assert title == 'Bob hat eine Ausgabe hinzugefügt'
    assert 'Kaffee' in body
    assert 'WG' in body


def test_locale_variants_normalize_to_supported_language():
    title, _ = render_notification(
        'expense.created',
        {
            'actor': 'Bob',
            'context': 'WG',
            'description': 'Kaffee',
            'amount': '3.00',
            'currency': 'EUR',
        },
        'de-AT',
    )
    assert title == 'Bob hat eine Ausgabe hinzugefügt'


def test_unknown_locale_falls_back_to_english():
    title, _ = render_notification(
        'expense.created',
        {'actor': 'X', 'context': 'Y', 'description': 'Z', 'amount': '1', 'currency': 'EUR'},
        'fr',
    )
    assert title == 'X a ajouté une dépense'


def test_unknown_event_type_returns_event_type_as_title():
    title, body = render_notification('some.unknown.event', {}, 'en')
    assert title == 'some.unknown.event'
    assert body == ''


def test_missing_placeholders_render_literally_without_crashing():
    # No `amount` in payload - the template keeps the placeholder rather than raising.
    _, body = render_notification(
        'expense.created',
        {'actor': 'Alice', 'context': 'Trip', 'description': 'Pizza'},
        'en',
    )
    assert body == '"Pizza" · Trip'


def test_settlement_template_includes_amount_and_currency():
    title, body = render_notification(
        'settlement.created',
        {'actor': 'Alice', 'context': 'WG', 'amount': '25.00', 'currency': 'EUR'},
        'en',
    )
    assert title == 'Alice recorded a settlement'
    assert '25.00 EUR' in body


def test_reminder_notifications_are_translated_for_supported_locales():
    title, body = render_notification(
        'reminder.settle',
        {'actor': 'Ayse', 'amount': '12.00', 'currency': 'TRY', 'context': 'Tatil'},
        'tr',
    )
    assert title == 'Splex'
    assert body == 'Ayse size Tatil içinde 12.00 TRY ödemenizi hatırlatıyor.'


def test_reminder_notifications_fall_back_to_english_for_unknown_locale():
    title, body = render_notification(
        'reminder.track_expense',
        {'actor': 'Alice', 'context': 'Trip'},
        'zz',
    )
    assert title == 'Splex'
    assert body == 'Alice reminds you to add any missing expenses in Trip.'

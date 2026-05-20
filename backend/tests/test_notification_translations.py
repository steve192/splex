from splex.notifications.translations import render_notification


def test_renders_english_template_with_placeholders():
    title, body = render_notification(
        "expense.created",
        {"actor": "Alice", "context": "Trip", "description": "Pizza", "amount": "10.00", "currency": "EUR"},
        "en",
    )
    assert title == "New expense"
    assert "Alice" in body
    assert "Pizza" in body
    assert "10.00 EUR" in body
    assert "Trip" in body


def test_renders_german_template():
    title, body = render_notification(
        "expense.created",
        {"actor": "Bob", "context": "WG", "description": "Kaffee", "amount": "3.00", "currency": "EUR"},
        "de",
    )
    assert title == "Neue Ausgabe"
    assert "Bob" in body
    assert "Kaffee" in body
    assert "WG" in body


def test_unknown_locale_falls_back_to_english():
    title, _ = render_notification(
        "expense.created", {"actor": "X", "context": "Y", "description": "Z", "amount": "1", "currency": "EUR"}, "fr"
    )
    assert title == "New expense"


def test_unknown_event_type_returns_event_type_as_title():
    title, body = render_notification("some.unknown.event", {}, "en")
    assert title == "some.unknown.event"
    assert body == ""


def test_missing_placeholders_render_literally_without_crashing():
    # No `amount` in payload — the template keeps the placeholder rather than raising.
    _, body = render_notification(
        "expense.created",
        {"actor": "Alice", "context": "Trip", "description": "Pizza"},
        "en",
    )
    assert "{amount}" in body


def test_settlement_template_includes_amount_and_currency():
    title, body = render_notification(
        "settlement.created",
        {"actor": "Alice", "context": "WG", "amount": "25.00", "currency": "EUR"},
        "en",
    )
    assert title == "Settlement recorded"
    assert "25.00 EUR" in body

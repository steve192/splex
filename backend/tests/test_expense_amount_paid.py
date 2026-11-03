from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from splex.activity.events import EventType
from splex.activity.models import ActivityEvent
from splex.currency.constants import ExchangeRateSource
from splex.currency.models import CurrencyRateSnapshot
from splex.expenses.services import create_expense
from splex.friends.services import create_friendship
from splex.notifications.models import Notification
from splex.participants.services import get_or_create_user_participant
from splex.shared.errors import ErrorCode

EXPENSE_DATE = date(2026, 11, 2)


@pytest.fixture
def trip(db):
    """Alice and Bob share EUR balances; NOK is 10 per EUR on the expense date."""
    user_model = get_user_model()
    alice = user_model.objects.create_user(email="alice@example.com", default_currency="EUR")
    bob = user_model.objects.create_user(email="bob@example.com")
    friendship = create_friendship(alice, get_or_create_user_participant(bob))
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rate_date=EXPENSE_DATE,
        rates={"EUR": "1", "NOK": "10"},
        source="seed",
    )
    client = APIClient()
    client.force_authenticate(alice)
    return {
        "alice": alice,
        "bob": bob,
        "alice_participant": get_or_create_user_participant(alice),
        "bob_participant": get_or_create_user_participant(bob),
        "friendship": friendship,
        "client": client,
    }


def _itemized_payload(trip, **overrides):
    alice_id = trip["alice_participant"].id
    payload = {
        "description": "Dinner",
        "amount": "1250.00",
        "currency": "NOK",
        "date": EXPENSE_DATE.isoformat(),
        "split_method": "exact",
        "split_payload": {
            "shares": [
                {"participant_id": alice_id, "amount": "800.00"},
                {"participant_id": trip["bob_participant"].id, "amount": "450.00"},
            ]
        },
        "payments": [{"participant_id": alice_id, "amount": "1250.00"}],
    }
    return {**payload, **overrides}


def _create_with_amount_paid(trip, amount_paid="108.73"):
    return create_expense(
        actor=trip["alice"],
        friendship=trip["friendship"],
        data={
            **_itemized_payload(trip, converted_amount=amount_paid),
            "date": EXPENSE_DATE,
        },
    )


def _owed_by_participant(expense):
    return {share.participant_id: share.amount for share in expense.owed_shares.all()}


def _assert_bob_notified(expense, event_type):
    event = ActivityEvent.objects.filter(expense=expense, event_type=event_type).latest("id")
    assert Notification.objects.filter(activity_event=event, user=event.actor).count() == 0
    assert Notification.objects.filter(activity_event=event).exclude(user=event.actor).exists()


@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_create_with_amount_paid_splits_it_in_receipt_proportions(trip):
    response = trip["client"].post(
        f"/api/friends/{trip['friendship'].id}/expenses/",
        _itemized_payload(trip, converted_amount="108.73"),
        format="json",
    )

    assert response.status_code == 201
    body = response.json()
    assert body["converted_amount"] == "108.73"
    assert body["exchange_rate"] == "0.08698400"
    assert body["exchange_rate_source"] == ExchangeRateSource.MANUAL
    assert body["exchange_rate_date"] is None
    assert body["official_exchange_rate"] == "0.10000000"
    owed = {row["participant_id"]: row["amount"] for row in body["owed"]}
    assert owed == {trip["alice_participant"].id: "69.59", trip["bob_participant"].id: "39.14"}
    assert [row["amount"] for row in body["payments"]] == ["108.73"]
    event = ActivityEvent.objects.get(event_type=EventType.EXPENSE_CREATED)
    assert Notification.objects.filter(activity_event=event, user=trip["bob"]).exists()


@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_create_without_amount_paid_uses_official_rate(trip):
    expense = create_expense(
        actor=trip["alice"],
        friendship=trip["friendship"],
        data={**_itemized_payload(trip, converted_amount=None), "date": EXPENSE_DATE},
    )

    assert expense.converted_amount == Decimal("125.00")
    assert expense.exchange_rate_source == "seed"
    assert expense.official_exchange_rate is None


@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_create_with_amount_paid_does_not_need_an_official_rate(trip):
    CurrencyRateSnapshot.objects.all().delete()

    expense = _create_with_amount_paid(trip)

    assert expense.converted_amount == Decimal("108.73")
    assert expense.exchange_rate_source == ExchangeRateSource.MANUAL
    assert expense.official_exchange_rate is None


@pytest.mark.parametrize(
    ("overrides", "code"),
    [
        ({"converted_amount": "0.00"}, ErrorCode.EXPENSE_AMOUNT_PAID_INVALID),
        (
            {"converted_amount": "108.73", "currency": "EUR"},
            ErrorCode.EXPENSE_AMOUNT_PAID_NOT_APPLICABLE,
        ),
    ],
)
@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_create_rejects_invalid_amount_paid(trip, overrides, code):
    response = trip["client"].post(
        f"/api/friends/{trip['friendship'].id}/expenses/",
        _itemized_payload(trip, **overrides),
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == code


@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_create_rejects_amount_paid_with_several_payers(trip):
    response = trip["client"].post(
        f"/api/friends/{trip['friendship'].id}/expenses/",
        _itemized_payload(
            trip,
            converted_amount="108.73",
            payments=[
                {"participant_id": trip["alice_participant"].id, "amount": "625.00"},
                {"participant_id": trip["bob_participant"].id, "amount": "625.00"},
            ],
        ),
        format="json",
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == ErrorCode.EXPENSE_AMOUNT_PAID_NOT_APPLICABLE


@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_add_amount_paid_later_replaces_official_conversion(trip):
    expense = create_expense(
        actor=trip["alice"],
        friendship=trip["friendship"],
        data={**_itemized_payload(trip), "date": EXPENSE_DATE},
    )
    assert expense.converted_amount == Decimal("125.00")

    response = trip["client"].patch(
        f"/api/expenses/{expense.id}/",
        _itemized_payload(trip, converted_amount="108.73"),
        format="json",
    )

    assert response.status_code == 200
    expense.refresh_from_db()
    assert expense.converted_amount == Decimal("108.73")
    assert expense.exchange_rate_source == ExchangeRateSource.MANUAL
    assert expense.official_exchange_rate == Decimal("0.10000000")
    assert _owed_by_participant(expense) == {
        trip["alice_participant"].id: Decimal("69.59"),
        trip["bob_participant"].id: Decimal("39.14"),
    }
    _assert_bob_notified(expense, EventType.EXPENSE_UPDATED)


@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_clearing_amount_paid_returns_to_official_rate(trip):
    expense = _create_with_amount_paid(trip)

    response = trip["client"].patch(
        f"/api/expenses/{expense.id}/",
        {"converted_amount": None},
        format="json",
    )

    assert response.status_code == 200
    expense.refresh_from_db()
    assert expense.converted_amount == Decimal("125.00")
    assert expense.exchange_rate == Decimal("0.10000000")
    assert expense.exchange_rate_source == "seed"
    assert expense.official_exchange_rate is None


@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_editing_receipt_amount_keeps_amount_paid(trip):
    expense = _create_with_amount_paid(trip)
    alice_id = trip["alice_participant"].id

    response = trip["client"].patch(
        f"/api/expenses/{expense.id}/",
        {
            "amount": "1300.00",
            "split_payload": {
                "shares": [
                    {"participant_id": alice_id, "amount": "850.00"},
                    {"participant_id": trip["bob_participant"].id, "amount": "450.00"},
                ]
            },
            "payments": [{"participant_id": alice_id, "amount": "1300.00"}],
        },
        format="json",
    )

    assert response.status_code == 200
    expense.refresh_from_db()
    assert expense.original_amount == Decimal("1300.00")
    assert expense.converted_amount == Decimal("108.73")
    assert expense.exchange_rate == Decimal("0.08363846")
    assert expense.exchange_rate_source == ExchangeRateSource.MANUAL


@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_changing_date_keeps_amount_paid_and_refreshes_official_rate(trip):
    expense = _create_with_amount_paid(trip)
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rate_date=date(2026, 11, 3),
        rates={"EUR": "1", "NOK": "11"},
        source="next-day",
    )

    response = trip["client"].patch(
        f"/api/expenses/{expense.id}/",
        {"date": "2026-11-03"},
        format="json",
    )

    assert response.status_code == 200
    expense.refresh_from_db()
    assert expense.converted_amount == Decimal("108.73")
    assert expense.exchange_rate == Decimal("0.08698400")
    assert expense.official_exchange_rate == Decimal("0.09090909")


def _context_currency_changes(trip):
    return {
        "amount": "125.00",
        "currency": "EUR",
        "split_method": "equal_all",
        "payments": [{"participant_id": trip["alice_participant"].id, "amount": "125.00"}],
    }


def _several_payers_changes(trip):
    return {
        "payments": [
            {"participant_id": trip["alice_participant"].id, "amount": "625.00"},
            {"participant_id": trip["bob_participant"].id, "amount": "625.00"},
        ]
    }


@pytest.mark.parametrize("changes", [_context_currency_changes, _several_payers_changes])
@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_amount_paid_is_dropped_when_no_longer_applicable(trip, changes):
    expense = _create_with_amount_paid(trip)

    response = trip["client"].patch(
        f"/api/expenses/{expense.id}/", changes(trip), format="json"
    )

    assert response.status_code == 200
    expense.refresh_from_db()
    assert expense.converted_amount == Decimal("125.00")
    assert expense.exchange_rate_source != ExchangeRateSource.MANUAL
    assert expense.official_exchange_rate is None

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings

from splex.currency.models import CurrencyRateSnapshot
from splex.expenses.models import Expense
from splex.expenses.services import create_expense, normalize_owed_shares
from splex.groups.services import add_unregistered_participant, create_group


@pytest.mark.django_db
def test_normalize_owed_shares_percentage_must_sum_to_100():
    with pytest.raises(ValueError, match="Percentages must sum to 100"):
        normalize_owed_shares(
            Decimal("100.00"),
            Expense.SplitMethod.PERCENTAGE,
            {
                "shares": [
                    {"participant_id": 1, "percentage": "70"},
                    {"participant_id": 2, "percentage": "20"},
                ]
            },
            [1, 2],
        )


@pytest.mark.django_db
def test_normalize_owed_shares_adjusted_equal_subtracts_adjustments_from_total():
    # 5.00 split between 2 people, +1.00 on participant 1
    # → base = (5 - 1) / 2 = 2.00; participant 1 owes 3.00, participant 2 owes 2.00
    shares = normalize_owed_shares(
        Decimal("5.00"),
        Expense.SplitMethod.ADJUSTED_EQUAL,
        {
            "participant_ids": [1, 2],
            "adjustments": [{"participant_id": 1, "amount": "1.00"}],
        },
        [1, 2],
    )
    assert shares == {1: Decimal("3.00"), 2: Decimal("2.00")}


@pytest.mark.django_db
def test_normalize_owed_shares_adjusted_equal_rejects_negative_share():
    with pytest.raises(ValueError, match="below zero"):
        normalize_owed_shares(
            Decimal("5.00"),
            Expense.SplitMethod.ADJUSTED_EQUAL,
            {
                "participant_ids": [1, 2],
                # An adjustment of -10 on a 5€ split with 2 people would force
                # participant 2 into a negative share.
                "adjustments": [{"participant_id": 1, "amount": "-10.00"}],
            },
            [1, 2],
        )


@pytest.mark.django_db
def test_create_expense_with_exact_shares_persists_expected_rows():
    user_model = get_user_model()
    alice = user_model.objects.create_user(email="alice@example.com")
    group = create_group(actor=alice, name="Trip", default_currency="EUR")
    bob = add_unregistered_participant(actor=alice, group=group, display_name="Bob")
    alice_participant_id = group.memberships.get(participant__user=alice).participant_id

    expense = create_expense(
        actor=alice,
        group=group,
        data={
            "description": "Hotel",
            "amount": "90.00",
            "currency": "EUR",
            "split_method": "exact",
            "split_payload": {
                "shares": [
                    {"participant_id": bob.id, "amount": "45.00"},
                    {"participant_id": alice_participant_id, "amount": "45.00"},
                ]
            },
        },
    )

    owed_total = sum((share.amount for share in expense.owed_shares.all()), Decimal("0.00"))
    paid_total = sum((share.amount for share in expense.payment_shares.all()), Decimal("0.00"))
    assert owed_total == Decimal("90.00")
    assert paid_total == Decimal("90.00")


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_create_expense_uses_snapshot_for_expense_date():
    user_model = get_user_model()
    alice = user_model.objects.create_user(email="alice@example.com")
    group = create_group(actor=alice, name="Trip", default_currency="EUR")
    add_unregistered_participant(actor=alice, group=group, display_name="Bob")
    expense_date = date(2025, 1, 15)
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rate_date=expense_date,
        rates={"EUR": "1", "USD": "2"},
        source="historic",
    )
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rates={"EUR": "1", "USD": "4"},
        source="current",
    )

    expense = create_expense(
        actor=alice,
        group=group,
        data={
            "description": "Dinner",
            "amount": "10.00",
            "currency": "USD",
            "date": expense_date,
            "split_method": "equal_all",
        },
    )

    assert expense.converted_amount == Decimal("5.00")
    assert expense.exchange_rate == Decimal("0.50000000")
    assert expense.exchange_rate_source == "historic"
    assert expense.exchange_rate_date == expense_date


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_create_foreign_currency_expense_accepts_original_currency_shares():
    user_model = get_user_model()
    alice = user_model.objects.create_user(email="alice@example.com")
    group = create_group(actor=alice, name="Trip", default_currency="EUR")
    bob = add_unregistered_participant(actor=alice, group=group, display_name="Bob")
    carla = add_unregistered_participant(actor=alice, group=group, display_name="Carla")
    alice_participant_id = group.memberships.get(participant__user=alice).participant_id
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rates={"EUR": "1", "NOK": "10"},
        source="seed",
    )

    expense = create_expense(
        actor=alice,
        group=group,
        data={
            "description": "Cabin",
            "amount": "5000.00",
            "currency": "NOK",
            "split_method": "exact",
            "split_payload": {
                "shares": [
                    {"participant_id": alice_participant_id, "amount": "1666.67"},
                    {"participant_id": bob.id, "amount": "1666.67"},
                    {"participant_id": carla.id, "amount": "1666.66"},
                ]
            },
            "payments": [
                {"participant_id": alice_participant_id, "amount": "5000.00"},
            ],
        },
    )

    owed_total = sum((share.amount for share in expense.owed_shares.all()), Decimal("0.00"))
    paid_total = sum((share.amount for share in expense.payment_shares.all()), Decimal("0.00"))
    assert expense.original_amount == Decimal("5000.00")
    assert expense.original_currency == "NOK"
    assert expense.converted_amount == Decimal("500.00")
    assert expense.converted_currency == "EUR"
    assert paid_total == Decimal("500.00")
    assert owed_total == Decimal("500.00")


@pytest.mark.django_db
def test_create_expense_is_idempotent_on_client_id():
    user_model = get_user_model()
    alice = user_model.objects.create_user(email="alice@example.com")
    group = create_group(actor=alice, name="Trip", default_currency="EUR")
    add_unregistered_participant(actor=alice, group=group, display_name="Bob")

    data = {
        "client_id": "mutation-42",
        "description": "Hotel",
        "amount": "60.00",
        "currency": "EUR",
        "split_method": "equal_all",
    }
    first = create_expense(actor=alice, group=group, data=data)
    second = create_expense(actor=alice, group=group, data=data)

    assert first.id == second.id
    assert Expense.objects.filter(client_id="mutation-42").count() == 1

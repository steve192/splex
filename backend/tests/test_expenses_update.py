from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from splex.activity.events import EventType
from splex.activity.models import ActivityEvent
from splex.currency.models import CurrencyRateSnapshot
from splex.expenses.models import Receipt
from splex.expenses.services import create_expense
from splex.friends.services import create_friendship
from splex.groups.services import (
    activate_group_membership,
    add_unregistered_participant,
    create_group,
)
from splex.participants.services import get_or_create_user_participant


@pytest.mark.django_db
def test_patch_group_expense_moves_to_group_with_same_involved_participants():
    user_model = get_user_model()
    alice = user_model.objects.create_user(email="alice@example.com")
    source = create_group(actor=alice, name="Trip", default_currency="EUR")
    bob = add_unregistered_participant(
        actor=alice,
        group=source,
        display_name="Bob",
    )
    alice_participant = get_or_create_user_participant(alice)
    target = create_group(actor=alice, name="Roommates", default_currency="EUR")
    activate_group_membership(group=target, participant=bob)
    expense = create_expense(
        actor=alice,
        group=source,
        data={
            "description": "Dinner",
            "amount": "40.00",
            "currency": "EUR",
            "split_method": "equal_selected",
            "split_payload": {
                "participant_ids": [alice_participant.id, bob.id],
            },
            "payments": [
                {"participant_id": alice_participant.id, "amount": "40.00"},
            ],
        },
    )
    receipt = Receipt.objects.create(
        expense=expense,
        group=source,
        uploaded_by=alice,
        storage_path="receipts/test.jpg",
        original_filename="test.jpg",
        content_type=Receipt.ContentType.JPEG,
        size_bytes=12,
    )

    client = APIClient()
    client.force_authenticate(alice)
    response = client.patch(
        f"/api/expenses/{expense.id}/",
        {
            "context_type": "group",
            "context_id": target.id,
            "description": "Dinner",
            "amount": "40.00",
            "currency": "EUR",
            "split_method": "equal_selected",
            "split_payload": {
                "participant_ids": [alice_participant.id, bob.id],
            },
            "payments": [
                {"participant_id": alice_participant.id, "amount": "40.00"},
            ],
        },
        format="json",
    )

    assert response.status_code == 200
    expense.refresh_from_db()
    receipt.refresh_from_db()
    assert expense.group == target
    assert expense.friendship is None
    assert receipt.group == target
    assert receipt.friendship is None
    event = ActivityEvent.objects.filter(
        event_type=EventType.EXPENSE_UPDATED,
        expense=expense,
    ).latest("id")
    assert event.group == target


@pytest.mark.django_db
def test_patch_group_expense_rejects_target_missing_payee():
    user_model = get_user_model()
    alice = user_model.objects.create_user(email="alice@example.com")
    source = create_group(actor=alice, name="Trip", default_currency="EUR")
    bob = add_unregistered_participant(
        actor=alice,
        group=source,
        display_name="Bob",
    )
    alice_participant = get_or_create_user_participant(alice)
    target = create_group(actor=alice, name="Solo", default_currency="EUR")
    expense = create_expense(
        actor=alice,
        group=source,
        data={
            "description": "Dinner",
            "amount": Decimal("40.00"),
            "currency": "EUR",
            "split_method": "equal_selected",
            "split_payload": {
                "participant_ids": [alice_participant.id, bob.id],
            },
            "payments": [
                {"participant_id": alice_participant.id, "amount": "40.00"},
            ],
        },
    )

    client = APIClient()
    client.force_authenticate(alice)
    response = client.patch(
        f"/api/expenses/{expense.id}/",
        {
            "context_type": "group",
            "context_id": target.id,
            "description": "Dinner",
            "amount": "40.00",
            "currency": "EUR",
            "split_method": "equal_selected",
            "split_payload": {
                "participant_ids": [alice_participant.id, bob.id],
            },
            "payments": [
                {"participant_id": alice_participant.id, "amount": "40.00"},
            ],
        },
        format="json",
    )

    assert response.status_code == 400
    expense.refresh_from_db()
    assert expense.group == source


@pytest.mark.django_db
def test_patch_friend_expense_rejects_context_change():
    user_model = get_user_model()
    alice = user_model.objects.create_user(email="alice@example.com")
    bob_user = user_model.objects.create_user(email="bob@example.com")
    alice_participant = get_or_create_user_participant(alice)
    bob_participant = get_or_create_user_participant(bob_user)
    friendship = create_friendship(alice, bob_participant)
    target = create_group(actor=alice, name="Trip", default_currency="EUR")
    activate_group_membership(group=target, participant=bob_participant)
    expense = create_expense(
        actor=alice,
        friendship=friendship,
        data={
            "description": "Coffee",
            "amount": "8.00",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [
                {"participant_id": alice_participant.id, "amount": "8.00"},
            ],
        },
    )

    client = APIClient()
    client.force_authenticate(alice)
    response = client.patch(
        f"/api/expenses/{expense.id}/",
        {
            "context_type": "group",
            "context_id": target.id,
            "description": "Coffee",
            "amount": "8.00",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [
                {"participant_id": alice_participant.id, "amount": "8.00"},
            ],
        },
        format="json",
    )

    assert response.status_code == 400
    expense.refresh_from_db()
    assert expense.friendship == friendship
    assert expense.group is None


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_patch_expense_amount_reuses_saved_exchange_rate():
    user_model = get_user_model()
    alice = user_model.objects.create_user(email="alice@example.com")
    group = create_group(actor=alice, name="Trip", default_currency="EUR")
    alice_participant = get_or_create_user_participant(alice)
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rates={"EUR": "1", "USD": "2"},
        source="seed",
    )
    expense = create_expense(
        actor=alice,
        group=group,
        data={
            "description": "Dinner",
            "amount": "10.00",
            "currency": "USD",
            "split_method": "equal_all",
            "payments": [{"participant_id": alice_participant.id, "amount": "10.00"}],
        },
    )
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rates={"EUR": "1", "USD": "4"},
        source="current",
    )

    client = APIClient()
    client.force_authenticate(alice)
    response = client.patch(
        f"/api/expenses/{expense.id}/",
        {
            "amount": "20.00",
            "payments": [{"participant_id": alice_participant.id, "amount": "20.00"}],
        },
        format="json",
    )

    assert response.status_code == 200
    expense.refresh_from_db()
    assert expense.original_amount == Decimal("20.00")
    assert expense.converted_amount == Decimal("10.00")
    assert expense.exchange_rate == Decimal("0.50000000")
    assert expense.exchange_rate_source == "seed"


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_patch_expense_currency_uses_snapshot_for_expense_date():
    user_model = get_user_model()
    alice = user_model.objects.create_user(email="alice@example.com")
    group = create_group(actor=alice, name="Trip", default_currency="EUR")
    alice_participant = get_or_create_user_participant(alice)
    expense = create_expense(
        actor=alice,
        group=group,
        data={
            "description": "Dinner",
            "amount": "10.00",
            "currency": "EUR",
            "date": date(2025, 1, 15),
            "split_method": "equal_all",
            "payments": [{"participant_id": alice_participant.id, "amount": "10.00"}],
        },
    )
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rate_date=expense.date,
        rates={"EUR": "1", "USD": "2"},
        source="historic",
    )
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rates={"EUR": "1", "USD": "4"},
        source="current",
    )

    client = APIClient()
    client.force_authenticate(alice)
    response = client.patch(
        f"/api/expenses/{expense.id}/",
        {
            "amount": "10.00",
            "currency": "USD",
            "payments": [{"participant_id": alice_participant.id, "amount": "10.00"}],
        },
        format="json",
    )

    assert response.status_code == 200
    expense.refresh_from_db()
    assert expense.original_currency == "USD"
    assert expense.converted_amount == Decimal("5.00")
    assert expense.exchange_rate == Decimal("0.50000000")
    assert expense.exchange_rate_source == "historic"


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_patch_foreign_currency_expense_accepts_original_currency_shares():
    user_model = get_user_model()
    alice = user_model.objects.create_user(email="alice@example.com")
    group = create_group(actor=alice, name="Trip", default_currency="EUR")
    bob = add_unregistered_participant(actor=alice, group=group, display_name="Bob")
    alice_participant = get_or_create_user_participant(alice)
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
            "split_method": "equal_all",
            "payments": [{"participant_id": alice_participant.id, "amount": "5000.00"}],
        },
    )

    client = APIClient()
    client.force_authenticate(alice)
    response = client.patch(
        f"/api/expenses/{expense.id}/",
        {
            "amount": "6000.00",
            "currency": "NOK",
            "split_method": "exact",
            "split_payload": {
                "shares": [
                    {"participant_id": alice_participant.id, "amount": "3000.00"},
                    {"participant_id": bob.id, "amount": "3000.00"},
                ]
            },
            "payments": [{"participant_id": alice_participant.id, "amount": "6000.00"}],
        },
        format="json",
    )

    assert response.status_code == 200
    expense.refresh_from_db()
    owed_total = sum((share.amount for share in expense.owed_shares.all()), Decimal("0.00"))
    paid_total = sum((share.amount for share in expense.payment_shares.all()), Decimal("0.00"))
    assert expense.original_amount == Decimal("6000.00")
    assert expense.converted_amount == Decimal("600.00")
    assert paid_total == Decimal("600.00")
    assert owed_total == Decimal("600.00")


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_patch_expense_date_recalculates_with_new_date_rate():
    user_model = get_user_model()
    alice = user_model.objects.create_user(email="alice@example.com")
    group = create_group(actor=alice, name="Trip", default_currency="EUR")
    alice_participant = get_or_create_user_participant(alice)
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rate_date=date(2025, 1, 15),
        rates={"EUR": "1", "USD": "2"},
        source="old-date",
    )
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rate_date=date(2025, 1, 20),
        rates={"EUR": "1", "USD": "4"},
        source="new-date",
    )
    expense = create_expense(
        actor=alice,
        group=group,
        data={
            "description": "Dinner",
            "amount": "10.00",
            "currency": "USD",
            "date": date(2025, 1, 15),
            "split_method": "equal_all",
            "payments": [{"participant_id": alice_participant.id, "amount": "10.00"}],
        },
    )

    client = APIClient()
    client.force_authenticate(alice)
    response = client.patch(
        f"/api/expenses/{expense.id}/",
        {
            "date": "2025-01-20",
            "payments": [{"participant_id": alice_participant.id, "amount": "10.00"}],
        },
        format="json",
    )

    assert response.status_code == 200
    expense.refresh_from_db()
    assert expense.date == date(2025, 1, 20)
    assert expense.converted_amount == Decimal("2.50")
    assert expense.exchange_rate == Decimal("0.25000000")
    assert expense.exchange_rate_source == "new-date"
    assert expense.exchange_rate_date == date(2025, 1, 20)

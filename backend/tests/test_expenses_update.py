from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from splex.activity.events import EventType
from splex.activity.models import ActivityEvent
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

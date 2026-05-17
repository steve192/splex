from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from splex.balances.selectors import group_pair_balances_for_user
from splex.expenses.services import create_expense
from splex.groups.services import add_unregistered_participant, create_group
from splex.participants.services import get_or_create_user_participant
from splex.settlements.services import create_settlement


@pytest.mark.django_db
def test_equal_split_expense_and_partial_settlement_update_pair_balance():
    User = get_user_model()
    alice = User.objects.create_user(email="alice@example.com")
    group = create_group(actor=alice, name="Trip", default_currency="EUR")
    bob = add_unregistered_participant(actor=alice, group=group, display_name="Bob")

    create_expense(
        actor=alice,
        group=group,
        data={
            "description": "Dinner",
            "amount": "40.00",
            "currency": "EUR",
            "split_method": "equal_all",
        },
    )

    balances = group_pair_balances_for_user(group, alice)
    assert balances[bob.id] == Decimal("20.00")

    create_settlement(
        actor=alice,
        group=group,
        data={
            "payer_participant_id": bob.id,
            "receiver_participant_id": get_or_create_user_participant(alice).id,
            "amount": "5.00",
        },
    )

    balances = group_pair_balances_for_user(group, alice)
    assert balances[bob.id] == Decimal("15.00")


@pytest.mark.django_db
def test_multiple_payers_are_supported():
    User = get_user_model()
    alice = User.objects.create_user(email="alice@example.com")
    group = create_group(actor=alice, name="Trip", default_currency="EUR")
    bob = add_unregistered_participant(actor=alice, group=group, display_name="Bob")
    alice_participant = get_or_create_user_participant(alice)

    create_expense(
        actor=alice,
        group=group,
        data={
            "description": "Tickets",
            "amount": "100.00",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [
                {"participant_id": alice_participant.id, "amount": "70.00"},
                {"participant_id": bob.id, "amount": "30.00"},
            ],
        },
    )

    balances = group_pair_balances_for_user(group, alice)
    assert balances[bob.id] == Decimal("20.00")


from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from splex.expenses.models import Expense
from splex.expenses.services import create_expense, normalize_owed_shares
from splex.groups.services import add_unregistered_participant, create_group


@pytest.mark.django_db
def test_normalize_owed_shares_percentage_must_sum_to_100():
    with pytest.raises(ValueError, match="Percentages must sum to 100"):
        normalize_owed_shares(
            Decimal("100.00"),
            Expense.SplitMethod.PERCENTAGE,
            {"shares": [{"participant_id": 1, "percentage": "70"}, {"participant_id": 2, "percentage": "20"}]},
            [1, 2],
        )


@pytest.mark.django_db
def test_normalize_owed_shares_adjusted_equal_must_sum_total():
    with pytest.raises(ValueError, match="Adjusted owed shares must sum"):
        normalize_owed_shares(
            Decimal("100.00"),
            Expense.SplitMethod.ADJUSTED_EQUAL,
            {
                "participant_ids": [1, 2],
                "adjustments": [{"participant_id": 1, "amount": "10.00"}],
            },
            [1, 2],
        )


@pytest.mark.django_db
def test_create_expense_with_exact_shares_persists_expected_rows():
    User = get_user_model()
    alice = User.objects.create_user(email="alice@example.com")
    group = create_group(actor=alice, name="Trip", default_currency="EUR")
    bob = add_unregistered_participant(actor=alice, group=group, display_name="Bob")

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
                    {"participant_id": group.memberships.get(participant__user=alice).participant_id, "amount": "45.00"},
                ]
            },
        },
    )

    owed_total = sum((share.amount for share in expense.owed_shares.all()), Decimal("0.00"))
    paid_total = sum((share.amount for share in expense.payment_shares.all()), Decimal("0.00"))
    assert owed_total == Decimal("90.00")
    assert paid_total == Decimal("90.00")

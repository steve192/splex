"""Regression: the combined ledger feed must be ordered by the user-meaningful
date (expense.date / settlement.created_at.date()), not by row insertion time.

Without this, recording an old receipt today would push the historical entry
above today's actually-most-recent expense."""

from datetime import date

import pytest
from django.contrib.auth import get_user_model

from splex.expenses.services import create_expense
from splex.groups.services import create_group
from splex.ledger.selectors import paginated_ledger_response
from splex.participants.services import get_or_create_user_participant


def _make_expense(owner, group, *, description: str, expense_date: date):
    owner_p = get_or_create_user_participant(owner)
    return create_expense(
        actor=owner,
        group=group,
        data={
            "description": description,
            "amount": "10",
            "currency": "EUR",
            "date": expense_date,
            "split_method": "equal_all",
            "payments": [{"participant_id": owner_p.id, "amount": "10"}],
        },
    )


@pytest.mark.django_db
def test_ledger_is_ordered_by_expense_date_not_insertion_order():
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")

    # Insert in scrambled order; the latest-dated should still come first.
    _make_expense(owner, group, description="middle", expense_date=date(2026, 3, 15))
    _make_expense(owner, group, description="old", expense_date=date(2026, 1, 5))
    _make_expense(owner, group, description="newest", expense_date=date(2026, 5, 1))

    items = paginated_ledger_response(group=group)
    descriptions = [item["expense"]["description"] for item in items]
    assert descriptions == ["newest", "middle", "old"]


@pytest.mark.django_db
def test_ledger_search_filters_by_description_amount_and_participant_name():
    user_model = get_user_model()
    owner = user_model.objects.create_user(
        email="owner@example.com", display_name="Alice"
    )
    group = create_group(actor=owner, name="Trip", default_currency="EUR")

    _make_expense(owner, group, description="Groceries", expense_date=date(2026, 5, 1))
    _make_expense(owner, group, description="Taxi ride", expense_date=date(2026, 5, 2))

    # Description match.
    results = paginated_ledger_response(group=group, search="grocer", limit=50, offset=0)
    assert [item["expense"]["description"] for item in results["results"]] == ["Groceries"]

    # Payer/payee name match returns every expense the participant is part of.
    results = paginated_ledger_response(group=group, search="alice", limit=50, offset=0)
    assert {item["expense"]["description"] for item in results["results"]} == {
        "Groceries",
        "Taxi ride",
    }

    # Amount match (both expenses are 10).
    results = paginated_ledger_response(group=group, search="10", limit=50, offset=0)
    assert len(results["results"]) == 2

    # No match.
    results = paginated_ledger_response(group=group, search="nonexistent", limit=50, offset=0)
    assert results["results"] == []


@pytest.mark.django_db
def test_same_day_expenses_are_ordered_by_insertion_newest_first():
    """Stable tiebreaker - entries on the same date come back newest-added first."""
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")

    same_day = date(2026, 5, 1)
    _make_expense(owner, group, description="first added", expense_date=same_day)
    _make_expense(owner, group, description="second added", expense_date=same_day)
    _make_expense(owner, group, description="third added", expense_date=same_day)

    items = paginated_ledger_response(group=group)
    descriptions = [item["expense"]["description"] for item in items]
    assert descriptions == ["third added", "second added", "first added"]

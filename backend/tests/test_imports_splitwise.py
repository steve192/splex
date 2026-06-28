"""Tests for the Splitwise import flow.

The Splitwise client is exercised via a fake that returns canned API
responses, so no network traffic is involved.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from splex.currency.models import CurrencyRateSnapshot
from splex.expenses.models import Expense, ExpenseOwedShare, ExpensePaymentShare
from splex.groups.models import Group, GroupMembership
from splex.imports.splitwise_client import SplitwiseAuthError, SplitwiseError
from splex.imports.splitwise_service import import_from_splitwise
from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant
from splex.settlements.models import Settlement

SELF_SW_ID = 1001
ALICE_SW_ID = 2002
BOB_SW_ID = 3003
FRIEND_SW_ID = 4004


def _sw_user(sw_id: int, name: str) -> dict:
    return {"id": sw_id, "first_name": name, "last_name": ""}


class FakeSplitwiseClient:
    """In-memory stand-in for ``SplitwiseClient`` used in tests."""

    def __init__(self, *, current_user, groups, friends, group_expenses, friend_expenses):
        self._current_user = current_user
        self._groups = groups
        self._friends = friends
        self._group_expenses = group_expenses
        self._friend_expenses = friend_expenses

    def get_current_user(self):
        return self._current_user

    def get_groups(self):
        return list(self._groups)

    def get_friends(self):
        return list(self._friends)

    def iter_expenses(self, *, group_id=None, friend_id=None):
        if group_id is not None:
            yield from self._group_expenses.get(group_id, [])
        elif friend_id is not None:
            yield from self._friend_expenses.get(friend_id, [])


def _make_user(email="me@example.com", currency="EUR"):
    User = get_user_model()
    return User.objects.create_user(
        email=email,
        display_name="Me",
        default_currency=currency,
    )


def _share(sw_id: int, name: str, paid: str, owed: str) -> dict:
    return {
        "user": _sw_user(sw_id, name),
        "user_id": sw_id,
        "paid_share": paid,
        "owed_share": owed,
    }


@pytest.mark.django_db
def test_import_creates_group_with_unregistered_members_and_expense():
    user = _make_user()
    client = FakeSplitwiseClient(
        current_user={"id": SELF_SW_ID, "first_name": "Me"},
        groups=[
            {
                "id": 11,
                "name": "Trip",
                "members": [
                    _sw_user(SELF_SW_ID, "Me"),
                    _sw_user(ALICE_SW_ID, "Alice"),
                    _sw_user(BOB_SW_ID, "Bob"),
                ],
            }
        ],
        friends=[],
        group_expenses={
            11: [
                {
                    "id": 1,
                    "description": "Dinner",
                    "cost": "30.00",
                    "currency_code": "EUR",
                    "date": "2026-01-15T12:00:00Z",
                    "payment": False,
                    "users": [
                        _share(SELF_SW_ID, "Me", "30.00", "10.00"),
                        _share(ALICE_SW_ID, "Alice", "0", "10.00"),
                        _share(BOB_SW_ID, "Bob", "0", "10.00"),
                    ],
                }
            ]
        },
        friend_expenses={},
    )

    summary = import_from_splitwise(
        actor=user,
        api_key="ignored",
        import_friends_as_groups=True,
        client=client,
    )

    assert summary.groups_created == 1
    assert summary.expenses_imported == 1
    assert summary.settlements_imported == 0

    group = Group.objects.get(name="Trip")
    assert group.default_currency == "EUR"
    # actor + 2 unregistered
    assert GroupMembership.objects.filter(group=group, removed_at__isnull=True).count() == 3
    unregistered_names = sorted(
        Participant.objects.filter(
            kind=Participant.Kind.UNREGISTERED,
            group_memberships__group=group,
        ).values_list("display_name", flat=True)
    )
    assert unregistered_names == ["Alice", "Bob"]

    expense = Expense.objects.get(group=group, description="Dinner")
    assert expense.split_method == Expense.SplitMethod.EXACT
    assert expense.original_amount == Decimal("30.00")
    actor_participant = get_or_create_user_participant(user)
    payer = ExpensePaymentShare.objects.get(expense=expense)
    assert payer.participant_id == actor_participant.id
    assert payer.amount == Decimal("30.00")
    owed_amounts = sorted(
        amount
        for amount in ExpenseOwedShare.objects.filter(expense=expense).values_list(
            "amount", flat=True
        )
    )
    assert owed_amounts == [Decimal("10.00"), Decimal("10.00"), Decimal("10.00")]


@pytest.mark.django_db
def test_import_skips_synthetic_non_group_bucket():
    user = _make_user()
    client = FakeSplitwiseClient(
        current_user={"id": SELF_SW_ID},
        groups=[
            {"id": 0, "name": "Non-group expenses", "members": []},
            {"id": 11, "name": "Trip", "members": [_sw_user(SELF_SW_ID, "Me")]},
        ],
        friends=[],
        group_expenses={},
        friend_expenses={},
    )

    summary = import_from_splitwise(
        actor=user,
        api_key="ignored",
        import_friends_as_groups=True,
        client=client,
    )

    assert summary.groups_created == 1
    assert Group.objects.filter(name="Non-group expenses").count() == 0
    assert Group.objects.filter(name="Trip").count() == 1


@pytest.mark.django_db
def test_import_friend_creates_two_person_group_with_unregistered_friend():
    user = _make_user()
    client = FakeSplitwiseClient(
        current_user={"id": SELF_SW_ID},
        groups=[],
        friends=[{"id": FRIEND_SW_ID, "first_name": "Pat", "last_name": "Doe"}],
        group_expenses={},
        friend_expenses={
            FRIEND_SW_ID: [
                {
                    "id": 99,
                    "description": "Coffee",
                    "cost": "8.00",
                    "currency_code": "EUR",
                    "date": "2026-02-03T09:00:00Z",
                    "payment": False,
                    "users": [
                        _share(SELF_SW_ID, "Me", "8.00", "4.00"),
                        _share(FRIEND_SW_ID, "Pat Doe", "0", "4.00"),
                    ],
                }
            ]
        },
    )

    summary = import_from_splitwise(
        actor=user,
        api_key="ignored",
        import_friends_as_groups=True,
        client=client,
    )

    assert summary.groups_created == 1
    assert summary.expenses_imported == 1
    group = Group.objects.get(name="Pat Doe")
    members = list(group.memberships.filter(removed_at__isnull=True))
    assert len(members) == 2
    unregistered = [
        m.participant for m in members if m.participant.kind == Participant.Kind.UNREGISTERED
    ]
    assert [p.display_name for p in unregistered] == ["Pat Doe"]


@pytest.mark.django_db
def test_import_friend_skips_expenses_already_imported_via_group():
    """``/get_expenses?friend_id=X`` includes the friend's group expenses too.

    Those were already imported through the group loop, so the friend loop has
    to drop any expense with a ``group_id`` to avoid double counting.
    """
    user = _make_user()
    friend_in_group = {
        "id": 50,
        "group_id": 11,
        "description": "Group dinner",
        "cost": "10.00",
        "currency_code": "EUR",
        "date": "2026-04-01",
        "payment": False,
        "users": [
            _share(SELF_SW_ID, "Me", "10.00", "5.00"),
            _share(FRIEND_SW_ID, "Pat Doe", "0", "5.00"),
        ],
    }
    friend_only = {
        "id": 51,
        "group_id": None,
        "description": "Coffee",
        "cost": "6.00",
        "currency_code": "EUR",
        "date": "2026-04-02",
        "payment": False,
        "users": [
            _share(SELF_SW_ID, "Me", "6.00", "3.00"),
            _share(FRIEND_SW_ID, "Pat Doe", "0", "3.00"),
        ],
    }
    client = FakeSplitwiseClient(
        current_user={"id": SELF_SW_ID},
        groups=[
            {
                "id": 11,
                "name": "Trip",
                "members": [
                    _sw_user(SELF_SW_ID, "Me"),
                    _sw_user(FRIEND_SW_ID, "Pat Doe"),
                ],
            }
        ],
        friends=[{"id": FRIEND_SW_ID, "first_name": "Pat", "last_name": "Doe"}],
        group_expenses={11: [friend_in_group]},
        friend_expenses={FRIEND_SW_ID: [friend_in_group, friend_only]},
    )

    summary = import_from_splitwise(
        actor=user,
        api_key="ignored",
        import_friends_as_groups=True,
        client=client,
    )

    # One group expense + one friend-only expense, in two different groups.
    assert summary.expenses_imported == 2
    assert Expense.objects.filter(group__name="Trip").count() == 1
    assert Expense.objects.filter(group__name="Pat Doe").count() == 1


@pytest.mark.django_db
def test_import_skips_friends_by_default():
    """The "friends as groups" workaround is opt-in - without it, no friend
    groups are created even if the Splitwise account has friends with history.
    """
    user = _make_user()
    client = FakeSplitwiseClient(
        current_user={"id": SELF_SW_ID},
        groups=[],
        friends=[{"id": FRIEND_SW_ID, "first_name": "Pat", "last_name": "Doe"}],
        group_expenses={},
        friend_expenses={
            FRIEND_SW_ID: [
                {
                    "id": 99,
                    "description": "Coffee",
                    "cost": "8.00",
                    "currency_code": "EUR",
                    "date": "2026-02-03",
                    "payment": False,
                    "users": [
                        _share(SELF_SW_ID, "Me", "8.00", "4.00"),
                        _share(FRIEND_SW_ID, "Pat Doe", "0", "4.00"),
                    ],
                }
            ]
        },
    )

    summary = import_from_splitwise(actor=user, api_key="ignored", client=client)

    assert summary.groups_created == 0
    assert summary.expenses_imported == 0
    assert Group.objects.count() == 0


@pytest.mark.django_db
def test_import_payment_expense_creates_settlement():
    user = _make_user()
    client = FakeSplitwiseClient(
        current_user={"id": SELF_SW_ID},
        groups=[
            {
                "id": 11,
                "name": "Trip",
                "members": [_sw_user(SELF_SW_ID, "Me"), _sw_user(ALICE_SW_ID, "Alice")],
            }
        ],
        friends=[],
        group_expenses={
            11: [
                {
                    "id": 1,
                    "description": "Payment",
                    "cost": "25.00",
                    "currency_code": "EUR",
                    "date": "2026-01-20T00:00:00Z",
                    "payment": True,
                    "users": [
                        _share(SELF_SW_ID, "Me", "25.00", "0"),
                        _share(ALICE_SW_ID, "Alice", "0", "25.00"),
                    ],
                }
            ]
        },
        friend_expenses={},
    )

    summary = import_from_splitwise(
        actor=user,
        api_key="ignored",
        import_friends_as_groups=True,
        client=client,
    )

    assert summary.expenses_imported == 0
    assert summary.settlements_imported == 1
    settlement = Settlement.objects.get()
    assert settlement.amount == Decimal("25.00")
    assert settlement.kind == Settlement.Kind.MANUAL


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_import_uses_snapshot_for_expense_date_when_converting():
    user = _make_user()
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rate_date=date(2025, 1, 15),
        rates={"EUR": "1", "USD": "2"},
        source="historic",
    )
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rates={"EUR": "1", "USD": "4"},
        source="current",
    )
    client = FakeSplitwiseClient(
        current_user={"id": SELF_SW_ID},
        groups=[
            {
                "id": 11,
                "name": "Trip",
                "members": [_sw_user(SELF_SW_ID, "Me"), _sw_user(ALICE_SW_ID, "Alice")],
            }
        ],
        friends=[],
        group_expenses={
            11: [
                {
                    "id": 1,
                    "description": "Anchor",
                    "cost": "1.00",
                    "currency_code": "EUR",
                    "date": "2025-01-14",
                    "payment": False,
                    "users": [_share(SELF_SW_ID, "Me", "1.00", "1.00")],
                },
                {
                    "id": 2,
                    "description": "Dinner",
                    "cost": "10.00",
                    "currency_code": "USD",
                    "date": "2025-01-15T12:00:00Z",
                    "payment": False,
                    "users": [
                        _share(SELF_SW_ID, "Me", "10.00", "5.00"),
                        _share(ALICE_SW_ID, "Alice", "0", "5.00"),
                    ],
                },
            ]
        },
        friend_expenses={},
    )

    import_from_splitwise(actor=user, api_key="ignored", client=client)

    expense = Expense.objects.get(description="Dinner")
    assert expense.converted_amount == Decimal("5.00")
    assert expense.exchange_rate == Decimal("0.50000000")
    assert expense.exchange_rate_source == "historic"
    assert sorted(share["amount"] for share in expense.split_metadata["shares"]) == [
        "5.00",
        "5.00",
    ]
    assert sum(
        (share.amount for share in expense.owed_shares.all()), Decimal("0.00")
    ) == Decimal("5.00")


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_import_payment_uses_snapshot_for_expense_date_when_converting():
    user = _make_user()
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rate_date=date(2025, 1, 15),
        rates={"EUR": "1", "USD": "2"},
        source="historic",
    )
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rates={"EUR": "1", "USD": "4"},
        source="current",
    )
    client = FakeSplitwiseClient(
        current_user={"id": SELF_SW_ID},
        groups=[
            {
                "id": 11,
                "name": "Trip",
                "members": [_sw_user(SELF_SW_ID, "Me"), _sw_user(ALICE_SW_ID, "Alice")],
            }
        ],
        friends=[],
        group_expenses={
            11: [
                {
                    "id": 1,
                    "description": "Anchor",
                    "cost": "1.00",
                    "currency_code": "EUR",
                    "date": "2025-01-14",
                    "payment": False,
                    "users": [_share(SELF_SW_ID, "Me", "1.00", "1.00")],
                },
                {
                    "id": 2,
                    "description": "Payment",
                    "cost": "10.00",
                    "currency_code": "USD",
                    "date": "2025-01-15T12:00:00Z",
                    "payment": True,
                    "users": [
                        _share(SELF_SW_ID, "Me", "10.00", "0"),
                        _share(ALICE_SW_ID, "Alice", "0", "10.00"),
                    ],
                },
            ]
        },
        friend_expenses={},
    )

    import_from_splitwise(actor=user, api_key="ignored", client=client)

    settlement = Settlement.objects.get()
    assert settlement.original_amount == Decimal("10.00")
    assert settlement.original_currency == "USD"
    assert settlement.amount == Decimal("5.00")
    assert settlement.exchange_rate == Decimal("0.50000000")
    assert settlement.exchange_rate_source == "historic"


@pytest.mark.django_db
def test_import_skips_deleted_expenses():
    user = _make_user()
    client = FakeSplitwiseClient(
        current_user={"id": SELF_SW_ID},
        groups=[{"id": 11, "name": "Trip", "members": [_sw_user(SELF_SW_ID, "Me")]}],
        friends=[],
        group_expenses={
            11: [
                {
                    "id": 1,
                    "description": "Old",
                    "cost": "5.00",
                    "currency_code": "EUR",
                    "date": "2026-01-01",
                    "deleted_at": "2026-01-02T12:00:00Z",
                    "users": [_share(SELF_SW_ID, "Me", "5.00", "5.00")],
                }
            ]
        },
        friend_expenses={},
    )

    summary = import_from_splitwise(
        actor=user,
        api_key="ignored",
        import_friends_as_groups=True,
        client=client,
    )
    assert summary.expenses_imported == 0
    assert Expense.objects.count() == 0


@pytest.mark.django_db
def test_import_handles_rounding_drift_to_match_total():
    """A 10.00 expense split three ways comes back as 3.33/3.33/3.34 in Splex,
    not 3.33/3.33/3.33 (which would not sum to the total).
    """
    user = _make_user()
    client = FakeSplitwiseClient(
        current_user={"id": SELF_SW_ID},
        groups=[
            {
                "id": 11,
                "name": "Trip",
                "members": [
                    _sw_user(SELF_SW_ID, "Me"),
                    _sw_user(ALICE_SW_ID, "Alice"),
                    _sw_user(BOB_SW_ID, "Bob"),
                ],
            }
        ],
        friends=[],
        group_expenses={
            11: [
                {
                    "id": 1,
                    "description": "Snacks",
                    "cost": "10.00",
                    "currency_code": "EUR",
                    "date": "2026-01-10",
                    "payment": False,
                    "users": [
                        _share(SELF_SW_ID, "Me", "10.00", "3.33"),
                        _share(ALICE_SW_ID, "Alice", "0", "3.33"),
                        _share(BOB_SW_ID, "Bob", "0", "3.34"),
                    ],
                }
            ]
        },
        friend_expenses={},
    )

    import_from_splitwise(actor=user, api_key="ignored", client=client)
    expense = Expense.objects.get()
    owed_total = sum(
        ExpenseOwedShare.objects.filter(expense=expense).values_list("amount", flat=True),
        Decimal("0"),
    )
    assert owed_total == expense.converted_amount


@pytest.mark.django_db
def test_import_raises_auth_error_when_current_user_missing():
    user = _make_user()
    client = FakeSplitwiseClient(
        current_user={},
        groups=[],
        friends=[],
        group_expenses={},
        friend_expenses={},
    )
    with pytest.raises(SplitwiseAuthError):
        import_from_splitwise(actor=user, api_key="ignored", client=client)


@pytest.mark.django_db
def test_import_endpoint_requires_api_key():
    user = _make_user()
    api_client = APIClient()
    api_client.force_authenticate(user=user)
    response = api_client.post("/api/imports/splitwise/", {}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_import_endpoint_returns_summary(monkeypatch):
    user = _make_user()
    fake = FakeSplitwiseClient(
        current_user={"id": SELF_SW_ID},
        groups=[
            {
                "id": 11,
                "name": "Trip",
                "members": [
                    _sw_user(SELF_SW_ID, "Me"),
                    _sw_user(ALICE_SW_ID, "Alice"),
                ],
            }
        ],
        friends=[],
        group_expenses={
            11: [
                {
                    "id": 1,
                    "description": "Lunch",
                    "cost": "12.00",
                    "currency_code": "EUR",
                    "date": "2026-03-01",
                    "payment": False,
                    "users": [
                        _share(SELF_SW_ID, "Me", "12.00", "6.00"),
                        _share(ALICE_SW_ID, "Alice", "0", "6.00"),
                    ],
                }
            ]
        },
        friend_expenses={},
    )
    monkeypatch.setattr(
        "splex.imports.splitwise_service.SplitwiseClient",
        lambda api_key: fake,
    )

    api_client = APIClient()
    api_client.force_authenticate(user=user)
    response = api_client.post(
        "/api/imports/splitwise/",
        {"api_key": "dummy"},
        format="json",
    )
    assert response.status_code == 200, response.content
    assert response.data["summary"]["groups_created"] == 1
    assert response.data["summary"]["expenses_imported"] == 1


@pytest.mark.django_db
def test_import_endpoint_does_not_expose_provider_error_detail(monkeypatch):
    user = _make_user()

    def fail_import(**_kwargs):
        raise SplitwiseError("provider response: password=not-for-the-client")

    monkeypatch.setattr("splex.imports.api.views.import_from_splitwise", fail_import)
    api_client = APIClient()
    api_client.force_authenticate(user=user)

    response = api_client.post(
        "/api/imports/splitwise/",
        {"api_key": "dummy"},
        format="json",
    )

    assert response.status_code == 502
    assert response.json() == {
        "error": {
            "code": "splitwise_failed",
            "message": "Could not import data from Splitwise.",
        }
    }
    assert "not-for-the-client" not in response.content.decode()


@pytest.mark.django_db
def test_iter_expenses_pages_through_multiple_pages(monkeypatch):
    """The real client must keep walking pages until the server short-pages."""
    from splex.imports import splitwise_client as splitwise_client_module

    page_size = splitwise_client_module.EXPENSE_PAGE_SIZE
    calls = []

    class FakeResponse:
        def __init__(self, payload):
            self._payload = payload
            self.status_code = 200
            self.text = ""

        def json(self):
            return self._payload

    def fake_get(url, params=None, headers=None, timeout=None):
        calls.append(params)
        offset = params["offset"]
        if offset == 0:
            return FakeResponse({"expenses": [{"id": i} for i in range(page_size)]})
        return FakeResponse({"expenses": [{"id": page_size}]})

    import requests

    session = requests.Session()
    session.get = fake_get  # type: ignore[assignment]
    client = splitwise_client_module.SplitwiseClient("key", session=session)
    expenses = list(client.iter_expenses(group_id=99))
    assert len(expenses) == page_size + 1
    assert calls[0]["offset"] == 0
    assert calls[1]["offset"] == page_size

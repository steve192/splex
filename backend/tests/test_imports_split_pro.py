"""Tests for the Split Pro import flow.

The PostgreSQL client is exercised via a fake that returns canned rows, so no
real database is involved.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model

from splex.expenses.models import Expense, ExpenseOwedShare, ExpensePaymentShare
from splex.groups.models import Group, GroupMembership
from splex.imports.split_pro_client import SplitProConnection
from splex.imports.split_pro_service import (
    SplitProUserNotFoundError,
    import_from_split_pro,
    list_split_pro_users,
)
from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant
from splex.settlements.models import Settlement

SELF_ID = 1
ALICE_ID = 2
BOB_ID = 3
FRIEND_ID = 4


def _user(sp_id, name, email=""):
    return {"id": sp_id, "name": name, "email": email}


def _expense(*, id, name, paid_by, amount, split_type="EQUAL",
             currency="EUR", group_id=None,
             expense_date=datetime(2026, 4, 1, tzinfo=UTC),
             deleted_at=None):
    return {
        "id": id, "name": name, "paidBy": paid_by, "amount": amount,
        "splitType": split_type, "currency": currency, "groupId": group_id,
        "expenseDate": expense_date, "deletedAt": deleted_at,
    }


class FakeSplitProClient:
    """In-memory stand-in for ``SplitProClient`` used in tests."""

    def __init__(self, *, users, groups, group_members, group_expenses,
                 friend_expenses, participants):
        self._users_by_id = {int(u["id"]): u for u in users}
        self._users_by_email = {
            (u.get("email") or "").lower(): u for u in users
            if u.get("email")
        }
        self._groups = groups
        self._group_members = group_members
        self._group_expenses = group_expenses
        self._friend_expenses = friend_expenses
        self._participants = participants

    def find_user_by_email(self, email):
        return self._users_by_email.get(email.lower())

    def get_user(self, user_id):
        return self._users_by_id.get(int(user_id))

    def list_users(self):
        return list(self._users_by_id.values())

    def get_users(self, ids):
        return [self._users_by_id[int(i)] for i in ids if int(i) in self._users_by_id]

    def get_groups_for_user(self, user_id):
        return [g for g in self._groups if user_id in self._group_members.get(g["id"], [])]

    def get_group_members(self, group_id):
        return list(self._group_members.get(group_id, []))

    def get_group_expenses(self, group_id):
        return list(self._group_expenses.get(group_id, []))

    def get_friend_expenses(self, user_id):
        return [
            e for e in self._friend_expenses
            if any(p["userId"] == user_id for p in self._participants.get(e["id"], []))
        ]

    def get_participants_for_expenses(self, expense_ids):
        return {eid: list(self._participants.get(eid, [])) for eid in expense_ids}


def _make_user(email="me@example.com", currency="EUR"):
    User = get_user_model()
    return User.objects.create_user(
        email=email, display_name="Me", default_currency=currency,
    )


@pytest.mark.django_db
def test_import_creates_group_with_members_and_expense():
    """An equal-split expense gets mirrored with payer / owed shares aligned
    to Split-Pro's `paid - owed = participant.amount` convention."""
    actor = _make_user()
    fake = FakeSplitProClient(
        users=[
            _user(SELF_ID, "Me", "me@example.com"),
            _user(ALICE_ID, "Alice", "alice@example.com"),
            _user(BOB_ID, "Bob"),
        ],
        groups=[{"id": 10, "name": "Trip", "defaultCurrency": "EUR", "archivedAt": None}],
        group_members={10: [SELF_ID, ALICE_ID, BOB_ID]},
        group_expenses={
            10: [
                _expense(
                    id="e1", name="Dinner", paid_by=SELF_ID,
                    amount=3000, currency="EUR", group_id=10,
                ),
            ],
        },
        friend_expenses=[],
        participants={
            # 30.00 paid by SELF, equal split → owed=10.00 each.
            # SELF net = 30 - 10 = +20  → 2000 in cents.
            # ALICE/BOB net = -10        → -1000 in cents each.
            "e1": [
                {"userId": SELF_ID, "amount": 2000},
                {"userId": ALICE_ID, "amount": -1000},
                {"userId": BOB_ID, "amount": -1000},
            ],
        },
    )

    summary = import_from_split_pro(
        actor=actor,
        connection=SplitProConnection(host="x", port=5432, dbname="d", user="u", password="p"),
        actor_user_id=SELF_ID, client=fake,
    )

    assert summary.groups_created == 1
    assert summary.expenses_imported == 1
    group = Group.objects.get(name="Trip")
    assert group.default_currency == "EUR"
    assert GroupMembership.objects.filter(group=group, removed_at__isnull=True).count() == 3

    expense = Expense.objects.get(group=group)
    assert expense.original_amount == Decimal("30.00")
    actor_participant = get_or_create_user_participant(actor)
    paid = ExpensePaymentShare.objects.get(expense=expense)
    assert paid.participant_id == actor_participant.id
    assert paid.amount == Decimal("30.00")
    owed_amounts = sorted(
        amount for amount in ExpenseOwedShare.objects.filter(expense=expense)
        .values_list("amount", flat=True)
    )
    assert owed_amounts == [Decimal("10.00"), Decimal("10.00"), Decimal("10.00")]


@pytest.mark.django_db
def test_import_preserves_archived_state():
    actor = _make_user()
    archived = datetime(2025, 12, 1, tzinfo=UTC)
    fake = FakeSplitProClient(
        users=[_user(SELF_ID, "Me", "me@example.com")],
        groups=[{"id": 10, "name": "Old Trip", "defaultCurrency": "EUR",
                 "archivedAt": archived}],
        group_members={10: [SELF_ID]},
        group_expenses={},
        friend_expenses=[],
        participants={},
    )

    import_from_split_pro(
        actor=actor,
        connection=SplitProConnection(host="x", port=5432, dbname="d", user="u", password="p"),
        actor_user_id=SELF_ID, client=fake,
    )

    group = Group.objects.get(name="Old Trip")
    assert group.archived_at == archived


@pytest.mark.django_db
def test_import_settlement_creates_settlement_row():
    actor = _make_user()
    fake = FakeSplitProClient(
        users=[
            _user(SELF_ID, "Me", "me@example.com"),
            _user(ALICE_ID, "Alice"),
        ],
        groups=[{"id": 10, "name": "Trip", "defaultCurrency": "EUR", "archivedAt": None}],
        group_members={10: [SELF_ID, ALICE_ID]},
        group_expenses={
            10: [
                _expense(id="s1", name="Settle", paid_by=SELF_ID,
                         amount=2500, currency="EUR", group_id=10,
                         split_type="SETTLEMENT"),
            ],
        },
        friend_expenses=[],
        participants={
            "s1": [
                {"userId": SELF_ID, "amount": 2500},
                {"userId": ALICE_ID, "amount": -2500},
            ],
        },
    )

    summary = import_from_split_pro(
        actor=actor,
        connection=SplitProConnection(host="x", port=5432, dbname="d", user="u", password="p"),
        actor_user_id=SELF_ID, client=fake,
    )

    assert summary.settlements_imported == 1
    assert summary.expenses_imported == 0
    settlement = Settlement.objects.get()
    assert settlement.amount == Decimal("25.00")
    assert settlement.kind == Settlement.Kind.MANUAL


@pytest.mark.django_db
def test_import_currency_conversion_is_skipped():
    actor = _make_user()
    fake = FakeSplitProClient(
        users=[_user(SELF_ID, "Me", "me@example.com")],
        groups=[{"id": 10, "name": "Trip", "defaultCurrency": "EUR", "archivedAt": None}],
        group_members={10: [SELF_ID]},
        group_expenses={
            10: [
                _expense(id="c1", name="Conversion", paid_by=SELF_ID,
                         amount=1000, currency="EUR", group_id=10,
                         split_type="CURRENCY_CONVERSION"),
            ],
        },
        friend_expenses=[],
        participants={"c1": [{"userId": SELF_ID, "amount": 0}]},
    )

    summary = import_from_split_pro(
        actor=actor,
        connection=SplitProConnection(host="x", port=5432, dbname="d", user="u", password="p"),
        actor_user_id=SELF_ID, client=fake,
    )
    assert summary.expenses_imported == 0
    assert summary.skipped_expenses == 1


@pytest.mark.django_db
def test_import_zero_decimal_currency_uses_raw_units():
    """JPY in Split Pro has 0 decimal digits, so the raw BigInt is already
    the full amount - 1000 means ¥1000, not ¥10.00."""
    actor = _make_user()
    fake = FakeSplitProClient(
        users=[
            _user(SELF_ID, "Me", "me@example.com"),
            _user(ALICE_ID, "Alice"),
        ],
        groups=[{"id": 10, "name": "Tokyo", "defaultCurrency": "JPY", "archivedAt": None}],
        group_members={10: [SELF_ID, ALICE_ID]},
        group_expenses={
            10: [
                _expense(id="j1", name="Ramen", paid_by=SELF_ID,
                         amount=1000, currency="JPY", group_id=10),
            ],
        },
        friend_expenses=[],
        participants={
            "j1": [
                {"userId": SELF_ID, "amount": 500},
                {"userId": ALICE_ID, "amount": -500},
            ],
        },
    )

    import_from_split_pro(
        actor=actor,
        connection=SplitProConnection(host="x", port=5432, dbname="d", user="u", password="p"),
        actor_user_id=SELF_ID, client=fake,
    )
    expense = Expense.objects.get()
    assert expense.original_amount == Decimal("1000.00")
    assert expense.original_currency == "JPY"


@pytest.mark.django_db
def test_import_friends_disabled_by_default():
    actor = _make_user()
    fake = FakeSplitProClient(
        users=[
            _user(SELF_ID, "Me", "me@example.com"),
            _user(FRIEND_ID, "Friend"),
        ],
        groups=[],
        group_members={},
        group_expenses={},
        friend_expenses=[
            _expense(id="f1", name="Coffee", paid_by=SELF_ID,
                     amount=600, currency="EUR"),
        ],
        participants={
            "f1": [
                {"userId": SELF_ID, "amount": 300},
                {"userId": FRIEND_ID, "amount": -300},
            ],
        },
    )

    summary = import_from_split_pro(
        actor=actor,
        connection=SplitProConnection(host="x", port=5432, dbname="d", user="u", password="p"),
        actor_user_id=SELF_ID, client=fake,
    )
    assert summary.groups_created == 0
    assert summary.expenses_imported == 0


@pytest.mark.django_db
def test_import_friends_enabled_creates_two_person_group():
    actor = _make_user()
    fake = FakeSplitProClient(
        users=[
            _user(SELF_ID, "Me", "me@example.com"),
            _user(FRIEND_ID, "Pat Doe"),
        ],
        groups=[],
        group_members={},
        group_expenses={},
        friend_expenses=[
            _expense(id="f1", name="Coffee", paid_by=SELF_ID,
                     amount=600, currency="EUR"),
        ],
        participants={
            "f1": [
                {"userId": SELF_ID, "amount": 300},
                {"userId": FRIEND_ID, "amount": -300},
            ],
        },
    )

    summary = import_from_split_pro(
        actor=actor,
        connection=SplitProConnection(host="x", port=5432, dbname="d", user="u", password="p"),
        actor_user_id=SELF_ID, import_friends_as_groups=True, client=fake,
    )
    assert summary.groups_created == 1
    assert summary.expenses_imported == 1
    group = Group.objects.get(name="Pat Doe")
    members = list(group.memberships.filter(removed_at__isnull=True))
    assert len(members) == 2
    unregistered = [
        m.participant for m in members
        if m.participant.kind == Participant.Kind.UNREGISTERED
    ]
    assert [p.display_name for p in unregistered] == ["Pat Doe"]


@pytest.mark.django_db
def test_import_friends_skips_multi_participant_non_group_expenses():
    """Non-group expenses with 3+ participants have no clean Splex
    equivalent - they must be counted as skipped rather than risk landing
    the same expense in two friend groups."""
    actor = _make_user()
    fake = FakeSplitProClient(
        users=[
            _user(SELF_ID, "Me", "me@example.com"),
            _user(ALICE_ID, "Alice"),
            _user(BOB_ID, "Bob"),
        ],
        groups=[],
        group_members={},
        group_expenses={},
        friend_expenses=[
            _expense(id="f1", name="Brunch", paid_by=SELF_ID,
                     amount=900, currency="EUR"),
        ],
        participants={
            "f1": [
                {"userId": SELF_ID, "amount": 600},
                {"userId": ALICE_ID, "amount": -300},
                {"userId": BOB_ID, "amount": -300},
            ],
        },
    )

    summary = import_from_split_pro(
        actor=actor,
        connection=SplitProConnection(host="x", port=5432, dbname="d", user="u", password="p"),
        actor_user_id=SELF_ID, import_friends_as_groups=True, client=fake,
    )
    assert summary.groups_created == 0
    assert summary.skipped_expenses == 1


@pytest.mark.django_db
def test_import_skips_deleted_expense():
    actor = _make_user()
    fake = FakeSplitProClient(
        users=[_user(SELF_ID, "Me", "me@example.com")],
        groups=[{"id": 10, "name": "Trip", "defaultCurrency": "EUR", "archivedAt": None}],
        group_members={10: [SELF_ID]},
        group_expenses={
            10: [
                _expense(id="d1", name="Old", paid_by=SELF_ID, amount=500,
                         currency="EUR", group_id=10,
                         deleted_at=datetime(2026, 1, 1, tzinfo=UTC)),
            ],
        },
        friend_expenses=[],
        participants={"d1": [{"userId": SELF_ID, "amount": 0}]},
    )

    summary = import_from_split_pro(
        actor=actor,
        connection=SplitProConnection(host="x", port=5432, dbname="d", user="u", password="p"),
        actor_user_id=SELF_ID, client=fake,
    )
    assert summary.expenses_imported == 0
    assert Expense.objects.count() == 0


@pytest.mark.django_db
def test_import_raises_when_actor_user_id_does_not_exist():
    actor = _make_user(email="me@example.com")
    fake = FakeSplitProClient(
        users=[_user(ALICE_ID, "Alice", "alice@example.com")],
        groups=[], group_members={}, group_expenses={},
        friend_expenses=[], participants={},
    )
    with pytest.raises(SplitProUserNotFoundError):
        import_from_split_pro(
            actor=actor,
            connection=SplitProConnection(host="x", port=5432, dbname="d", user="u", password="p"),
            actor_user_id=9999, client=fake,
        )


@pytest.mark.django_db
def test_import_endpoint_validates_payload():
    from rest_framework.test import APIClient
    actor = _make_user()
    api_client = APIClient()
    api_client.force_authenticate(user=actor)
    response = api_client.post("/api/imports/split-pro/", {}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_endpoints_return_403_when_risky_imports_disabled(settings):
    """When ENABLE_RISKY_IMPORTS is off, both Split Pro endpoints refuse the
    request before touching the database - the credentials never leave the
    server."""
    from rest_framework.test import APIClient
    settings.ENABLE_RISKY_IMPORTS = False
    actor = _make_user()
    api_client = APIClient()
    api_client.force_authenticate(user=actor)
    payload = {
        "host": "db", "port": 5432, "dbname": "d", "user": "u", "password": "p",
    }
    list_response = api_client.post(
        "/api/imports/split-pro/users/", payload, format="json",
    )
    assert list_response.status_code == 403
    assert list_response.data["error"]["code"] == "imports_disabled"
    import_response = api_client.post(
        "/api/imports/split-pro/",
        {**payload, "actor_user_id": 1},
        format="json",
    )
    assert import_response.status_code == 403
    assert import_response.data["error"]["code"] == "imports_disabled"


@pytest.mark.django_db
def test_login_config_exposes_risky_imports_flag(settings):
    from rest_framework.test import APIClient
    settings.ENABLE_RISKY_IMPORTS = True
    response = APIClient().get("/api/login/config/")
    assert response.status_code == 200
    assert response.data["risky_imports_enabled"] is True

    settings.ENABLE_RISKY_IMPORTS = False
    response = APIClient().get("/api/login/config/")
    assert response.data["risky_imports_enabled"] is False


def test_list_split_pro_users_returns_normalized_rows():
    fake = FakeSplitProClient(
        users=[
            _user(SELF_ID, "Me", "me@example.com"),
            _user(ALICE_ID, "Alice"),
        ],
        groups=[], group_members={}, group_expenses={},
        friend_expenses=[], participants={},
    )
    users = list_split_pro_users(
        SplitProConnection(host="x", port=5432, dbname="d", user="u", password="p"),
        client=fake,
    )
    assert {user["id"] for user in users} == {SELF_ID, ALICE_ID}
    me = next(user for user in users if user["id"] == SELF_ID)
    assert me["name"] == "Me"
    assert me["email"] == "me@example.com"
    alice = next(user for user in users if user["id"] == ALICE_ID)
    assert alice["email"] == ""

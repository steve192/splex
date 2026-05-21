from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from splex.expenses.services import create_expense
from splex.friends.services import create_friendship
from splex.groups.models import GroupMembership
from splex.groups.services import add_unregistered_participant, create_group
from splex.groups.statistics import friendship_statistics, group_statistics
from splex.participants.services import get_or_create_user_participant


def _add_user_to_group(user, group):
    GroupMembership.objects.create(group=group, participant=get_or_create_user_participant(user))


def _make_expense(owner, group, *, description, amount, expense_date=None):
    owner_p = get_or_create_user_participant(owner)
    data = {
        "description": description,
        "amount": amount,
        "currency": "EUR",
        "split_method": "equal_all",
        "payments": [{"participant_id": owner_p.id, "amount": amount}],
    }
    if expense_date is not None:
        data["date"] = expense_date
    return create_expense(actor=owner, group=group, data=data)


@pytest.mark.django_db
def test_empty_group_returns_zeroed_summary_and_full_monthly_series():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")

    stats = group_statistics(group)

    assert stats["summary"]["expense_count"] == 0
    assert stats["summary"]["total_amount"] == "0.00"
    assert stats["summary"]["first_expense_date"] is None
    assert stats["summary"]["currency"] == "EUR"
    assert len(stats["monthly"]) == 12  # always returns the rolling window
    assert all(row["total"] == "0.00" for row in stats["monthly"])
    assert stats["top_descriptions"] == []
    assert stats["biggest_expenses"] == []
    assert stats["locations"] == []
    assert stats["pair_stats"] == []
    assert len(stats["day_of_week"]) == 7
    assert all(row["count"] == 0 for row in stats["day_of_week"])
    assert stats["summary"]["spend_per_week"] == "0.00"
    # Single-member group still has a contribution row at zero.
    assert len(stats["contributions"]) == 1
    assert stats["contributions"][0]["paid"] == "0.00"


@pytest.mark.django_db
def test_summary_totals_average_and_currency_breakdown():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    _make_expense(owner, group, description="Pizza", amount="10.00")
    _make_expense(owner, group, description="Pizza", amount="20.00")
    _make_expense(owner, group, description="Bus", amount="5.50")

    stats = group_statistics(group)

    assert stats["summary"]["expense_count"] == 3
    assert stats["summary"]["total_amount"] == "35.50"
    assert stats["summary"]["average_amount"] == "11.83"
    # All expenses created in EUR, so a single bucket of 35.50 / 3.
    assert stats["summary"]["currency_breakdown"] == [
        {"currency": "EUR", "total": "35.50", "count": 3}
    ]


@pytest.mark.django_db
def test_monthly_series_buckets_by_month_and_zero_fills():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    today = date.today()
    _make_expense(owner, group, description="A", amount="10.00", expense_date=today)
    _make_expense(owner, group, description="B", amount="5.00", expense_date=today)

    stats = group_statistics(group)
    monthly = stats["monthly"]
    current_month_iso = today.replace(day=1).isoformat()
    current = next(row for row in monthly if row["month"] == current_month_iso)
    assert current["total"] == "15.00"

    # All other buckets must be zero.
    others = [row for row in monthly if row["month"] != current_month_iso]
    assert all(row["total"] == "0.00" for row in others)


@pytest.mark.django_db
def test_top_descriptions_groups_case_insensitively():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    _make_expense(owner, group, description="Pizza", amount="10.00")
    _make_expense(owner, group, description="pizza", amount="20.00")
    _make_expense(owner, group, description="PIZZA", amount="15.00")
    _make_expense(owner, group, description="Bus", amount="5.00")

    stats = group_statistics(group)

    top = stats["top_descriptions"]
    assert top[0]["description"].lower() == "pizza"
    assert top[0]["count"] == 3
    assert top[0]["total"] == "45.00"
    assert top[1]["description"].lower() == "bus"
    assert top[1]["count"] == 1


@pytest.mark.django_db
def test_contributions_show_paid_versus_share_per_member():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    bob = add_unregistered_participant(actor=owner, group=group, display_name="Bob")
    owner_p = get_or_create_user_participant(owner)

    # Owner pays 30, split equally between the 2 members → each owes 15.
    create_expense(
        actor=owner,
        group=group,
        data={
            "description": "Dinner",
            "amount": "30.00",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [{"participant_id": owner_p.id, "amount": "30.00"}],
        },
    )

    stats = group_statistics(group)
    rows = {row["display_name"]: row for row in stats["contributions"]}
    assert rows["Owner"]["paid"] == "30.00"
    assert rows["Owner"]["share"] == "15.00"
    assert rows["Bob"]["paid"] == "0.00"
    assert rows["Bob"]["share"] == "15.00"


@pytest.mark.django_db
def test_biggest_expenses_returns_top_5_by_converted_amount():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    amounts = ["10", "100", "5", "50", "200", "1", "75"]
    for i, amount in enumerate(amounts):
        _make_expense(owner, group, description=f"E{i}", amount=amount)

    stats = group_statistics(group)
    big = stats["biggest_expenses"]
    assert [row["amount"] for row in big] == ["200.00", "100.00", "75.00", "50.00", "10.00"]


@pytest.mark.django_db
def test_deleted_expenses_are_excluded_from_all_stats():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    expense = _make_expense(owner, group, description="Ghost", amount="100.00")
    _make_expense(owner, group, description="Real", amount="20.00")

    # Soft-delete the first one.
    from django.utils import timezone

    expense.deleted_at = timezone.now()
    expense.save(update_fields=["deleted_at"])

    stats = group_statistics(group)
    assert stats["summary"]["expense_count"] == 1
    assert stats["summary"]["total_amount"] == "20.00"
    assert all(row["description"] != "Ghost" for row in stats["top_descriptions"])
    assert all(row["description"] != "Ghost" for row in stats["biggest_expenses"])


@pytest.mark.django_db
def test_endpoint_requires_group_membership():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    outsider = User.objects.create_user(email="outsider@example.com", display_name="Outsider")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")

    client = APIClient()
    client.force_authenticate(user=outsider)
    response = client.get(f"/api/groups/{group.id}/statistics/")
    assert response.status_code in (403, 404)


@pytest.mark.django_db
def test_endpoint_returns_aggregated_payload_for_member():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    _make_expense(owner, group, description="Pizza", amount="12.34")

    client = APIClient()
    client.force_authenticate(user=owner)
    response = client.get(f"/api/groups/{group.id}/statistics/")
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["expense_count"] == 1
    assert body["summary"]["total_amount"] == "12.34"
    assert any(row["description"].lower() == "pizza" for row in body["top_descriptions"])


@pytest.mark.django_db
def test_spend_per_week_is_money_with_currency():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    # Two expenses one week apart → total 21, span ≈ 1.14 weeks → ~18.32/wk.
    _make_expense(owner, group, description="A", amount="10.00", expense_date="2025-04-01")
    _make_expense(owner, group, description="B", amount="11.00", expense_date="2025-04-08")

    stats = group_statistics(group)
    # span_days = 8 → weeks = 8/7 ≈ 1.1428... → 21 / 1.1428 = 18.375
    assert stats["summary"]["spend_per_week"] == "18.38"
    assert stats["summary"]["currency"] == "EUR"


@pytest.mark.django_db
def test_locations_returns_geotagged_expenses_only():
    User = get_user_model()
    owner = User.objects.create_user(
        email="owner@example.com", display_name="Owner", location_tracking_enabled=True
    )
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    owner_p = get_or_create_user_participant(owner)
    create_expense(
        actor=owner,
        group=group,
        data={
            "description": "Hotel",
            "amount": "50.00",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [{"participant_id": owner_p.id, "amount": "50.00"}],
            "latitude": "48.137154",
            "longitude": "11.576124",
        },
    )
    _make_expense(owner, group, description="No-coords", amount="5.00")

    stats = group_statistics(group)
    assert len(stats["locations"]) == 1
    loc = stats["locations"][0]
    assert loc["description"] == "Hotel"
    assert abs(loc["latitude"] - 48.137154) < 1e-5
    assert abs(loc["longitude"] - 11.576124) < 1e-5
    assert loc["amount"] == "50.00"


@pytest.mark.django_db
def test_day_of_week_buckets_by_weekday():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    # 2025-04-07 was a Monday (weekday=0).
    _make_expense(owner, group, description="Mon1", amount="10", expense_date="2025-04-07")
    _make_expense(owner, group, description="Mon2", amount="5", expense_date="2025-04-14")
    _make_expense(owner, group, description="Sat", amount="20", expense_date="2025-04-12")

    stats = group_statistics(group)
    by_weekday = {row["weekday"]: row for row in stats["day_of_week"]}
    assert by_weekday[0]["count"] == 2
    assert by_weekday[0]["total"] == "15.00"
    assert by_weekday[5]["count"] == 1  # Saturday
    assert by_weekday[5]["total"] == "20.00"
    assert by_weekday[2]["count"] == 0  # Wednesday had nothing


@pytest.mark.django_db
def test_pair_stats_attribute_owed_amount_to_payer():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    bob = add_unregistered_participant(actor=owner, group=group, display_name="Bob")
    owner_p = get_or_create_user_participant(owner)

    # Owner pays 20, split equally → each owes 10 → owner "covered" 10 for Bob.
    create_expense(
        actor=owner,
        group=group,
        data={
            "description": "Dinner",
            "amount": "20.00",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [{"participant_id": owner_p.id, "amount": "20.00"}],
        },
    )

    stats = group_statistics(group)
    pairs = stats["pair_stats"]
    assert len(pairs) == 1
    assert pairs[0]["payer_id"] == owner_p.id
    assert pairs[0]["beneficiary_id"] == bob.id
    assert pairs[0]["count"] == 1
    assert pairs[0]["amount"] == "10.00"


@pytest.mark.django_db
def test_friendship_statistics_uses_friendship_default_currency():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    bob_user = User.objects.create_user(email="bob@example.com", display_name="Bob")
    bob_p = get_or_create_user_participant(bob_user)
    friendship = create_friendship(actor=owner, other_participant=bob_p)
    owner_p = get_or_create_user_participant(owner)

    create_expense(
        actor=owner,
        friendship=friendship,
        data={
            "description": "Lunch",
            "amount": "30.00",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [{"participant_id": owner_p.id, "amount": "30.00"}],
        },
    )

    stats = friendship_statistics(friendship)
    assert stats["summary"]["expense_count"] == 1
    assert stats["summary"]["total_amount"] == "30.00"
    assert stats["summary"]["currency"] == friendship.default_currency
    assert len(stats["contributions"]) == 2
    names = {row["display_name"] for row in stats["contributions"]}
    assert names == {"Owner", "Bob"}


@pytest.mark.django_db
def test_friendship_endpoint_requires_membership():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    bob_user = User.objects.create_user(email="bob@example.com", display_name="Bob")
    outsider = User.objects.create_user(email="outsider@example.com", display_name="Outsider")
    bob_p = get_or_create_user_participant(bob_user)
    friendship = create_friendship(actor=owner, other_participant=bob_p)

    client = APIClient()
    client.force_authenticate(user=outsider)
    response = client.get(f"/api/friends/{friendship.id}/statistics/")
    assert response.status_code in (403, 404)

    client.force_authenticate(user=owner)
    response = client.get(f"/api/friends/{friendship.id}/statistics/")
    assert response.status_code == 200

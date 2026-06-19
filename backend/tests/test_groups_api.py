from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from splex.expenses.services import create_expense
from splex.groups.services import add_unregistered_participant, create_group, update_group


@pytest.mark.django_db
def test_group_list_returns_archived_groups_and_current_user_balance():
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    add_unregistered_participant(actor=owner, group=group, display_name="Bob")
    archived = create_group(actor=owner, name="Old Trip", default_currency="USD")
    update_group(actor=owner, group=archived, data={"archived": True})

    create_expense(
        actor=owner,
        group=group,
        data={
            "description": "Dinner",
            "amount": Decimal("40.00"),
            "currency": "EUR",
            "split_method": "equal_all",
        },
    )

    client = APIClient()
    client.force_authenticate(owner)
    response = client.get("/api/groups/")

    assert response.status_code == 200
    rows_by_name = {row["name"]: row for row in response.data}
    assert rows_by_name["Trip"]["balance"] == "20.00"
    assert rows_by_name["Old Trip"]["archived_at"] is not None


def test_overview_endpoint_is_removed():
    response = APIClient().get("/api/overview/")

    assert response.status_code == 404

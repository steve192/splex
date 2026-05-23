import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from splex.expenses.services import create_expense
from splex.groups.services import create_group


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _make_expense(user, group, description, *, latitude="48.137", longitude="11.575"):
    user.location_tracking_enabled = True
    user.save(update_fields=["location_tracking_enabled"])
    return create_expense(
        actor=user,
        group=group,
        data={
            "description": description,
            "amount": "5.00",
            "currency": "EUR",
            "latitude": latitude,
            "longitude": longitude,
        },
    )


@pytest.mark.django_db
def test_location_suggestions_deduplicate_by_description():
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U")
    group = create_group(actor=user, name="Trip", default_currency="EUR")

    _make_expense(user, group, "Coffee")
    _make_expense(user, group, "Coffee")
    _make_expense(user, group, "Coffee")
    _make_expense(user, group, "Lunch")

    response = _auth_client(user).get(
        "/api/expenses/location-suggestions/?latitude=48.137&longitude=11.575&radius=500"
    )
    assert response.status_code == 200
    suggestions = response.data["suggestions"]
    # "Coffee" must appear once even though three expenses share it.
    assert suggestions.count("Coffee") == 1
    assert "Lunch" in suggestions


@pytest.mark.django_db
def test_location_suggestions_keep_newest_first():
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U")
    group = create_group(actor=user, name="Trip", default_currency="EUR")

    _make_expense(user, group, "Old")
    _make_expense(user, group, "Newer")
    _make_expense(user, group, "Newest")

    response = _auth_client(user).get(
        "/api/expenses/location-suggestions/?latitude=48.137&longitude=11.575&radius=500"
    )
    assert response.data["suggestions"] == ["Newest", "Newer", "Old"]

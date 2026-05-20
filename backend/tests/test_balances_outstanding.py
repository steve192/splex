import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from splex.balances.selectors import participant_outstanding_in_group
from splex.expenses.services import create_expense
from splex.groups.models import GroupMembership
from splex.groups.services import add_unregistered_participant, create_group
from splex.participants.services import get_or_create_user_participant


def _add_user_to_group(user, group):
    GroupMembership.objects.create(group=group, participant=get_or_create_user_participant(user))


@pytest.mark.django_db
def test_outstanding_lists_who_participant_owes():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    bob = add_unregistered_participant(actor=owner, group=group, display_name="Bob")
    owner_p = get_or_create_user_participant(owner)

    # Owner paid 10 split equally → Bob owes Owner 5.
    create_expense(
        actor=owner,
        group=group,
        data={
            "description": "X",
            "amount": "10",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [{"participant_id": owner_p.id, "amount": "10"}],
        },
    )

    result = participant_outstanding_in_group(group, bob)
    assert result["currency"] == "EUR"
    assert len(result["owes"]) == 1
    assert result["owes"][0]["participant_id"] == owner_p.id
    assert result["owes"][0]["amount"] == "5.00"
    assert result["owed_by"] == []


@pytest.mark.django_db
def test_outstanding_lists_who_owes_the_participant():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    bob = add_unregistered_participant(actor=owner, group=group, display_name="Bob")
    owner_p = get_or_create_user_participant(owner)

    create_expense(
        actor=owner,
        group=group,
        data={
            "description": "X",
            "amount": "10",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [{"participant_id": owner_p.id, "amount": "10"}],
        },
    )

    result = participant_outstanding_in_group(group, owner_p)
    assert result["owed_by"][0]["participant_id"] == bob.id
    assert result["owed_by"][0]["amount"] == "5.00"
    assert result["owes"] == []


@pytest.mark.django_db
def test_outstanding_empty_when_settled():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    bob = add_unregistered_participant(actor=owner, group=group, display_name="Bob")

    result = participant_outstanding_in_group(group, bob)
    assert result["owes"] == []
    assert result["owed_by"] == []


@pytest.mark.django_db
def test_outstanding_endpoint_returns_payload():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    other = User.objects.create_user(email="other@example.com", display_name="Other")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    _add_user_to_group(other, group)
    owner_p = get_or_create_user_participant(owner)

    create_expense(
        actor=owner,
        group=group,
        data={
            "description": "X",
            "amount": "10",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [{"participant_id": owner_p.id, "amount": "10"}],
        },
    )

    client = APIClient()
    client.force_authenticate(user=owner)
    other_p = get_or_create_user_participant(other)
    response = client.get(f"/api/groups/{group.id}/participants/{other_p.id}/outstanding/")
    assert response.status_code == 200
    assert response.data["currency"] == "EUR"
    assert len(response.data["owes"]) == 1
    assert response.data["owes"][0]["display_name"] == "Owner"


@pytest.mark.django_db
def test_outstanding_endpoint_rejects_non_member():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    outsider = User.objects.create_user(email="outsider@example.com", display_name="X")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    placeholder = add_unregistered_participant(actor=owner, group=group, display_name="Bob")

    client = APIClient()
    client.force_authenticate(user=outsider)
    response = client.get(f"/api/groups/{group.id}/participants/{placeholder.id}/outstanding/")
    assert response.status_code in (403, 404)

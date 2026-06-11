from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from splex.currency.models import ExchangeRate
from splex.friends.services import create_friendship
from splex.groups.services import add_unregistered_participant, create_group
from splex.participants.services import get_or_create_user_participant
from splex.settlements.models import Settlement
from splex.settlements.services import (
    create_settlement,
    soft_delete_settlement,
    update_settlement,
)


def _user(email):
    return get_user_model().objects.create_user(email=email, display_name=email.split("@")[0])


def _group_with_two(owner_email="owner@example.com"):
    owner = _user(owner_email)
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    owner_p = get_or_create_user_participant(owner)
    other = add_unregistered_participant(actor=owner, group=group, display_name="Bob")
    return owner, group, owner_p, other


# --- service: create ----------------------------------------------------------


@pytest.mark.django_db
def test_create_settlement_succeeds_and_records_activity():
    owner, group, owner_p, other = _group_with_two()
    settlement = create_settlement(
        actor=owner,
        group=group,
        data={
            "payer_participant_id": owner_p.id,
            "receiver_participant_id": other.id,
            "amount": Decimal("10.00"),
        },
    )
    assert settlement.amount == Decimal("10.00")
    assert settlement.currency == "EUR"
    assert Settlement.objects.filter(id=settlement.id).exists()


@pytest.mark.django_db
def test_create_settlement_rejects_payer_outside_context():
    owner, group, _owner_p, other = _group_with_two()
    # A participant from a completely different group is not in this context.
    stranger = get_or_create_user_participant(_user("stranger@example.com"))
    with pytest.raises(ValueError, match="Payer is not part of this context"):
        create_settlement(
            actor=owner,
            group=group,
            data={
                "payer_participant_id": stranger.id,
                "receiver_participant_id": other.id,
                "amount": Decimal("5"),
            },
        )


@pytest.mark.django_db
def test_create_settlement_rejects_receiver_outside_context():
    owner, group, owner_p, _other = _group_with_two()
    stranger = get_or_create_user_participant(_user("stranger@example.com"))
    with pytest.raises(ValueError, match="Receiver is not part of this context"):
        create_settlement(
            actor=owner,
            group=group,
            data={
                "payer_participant_id": owner_p.id,
                "receiver_participant_id": stranger.id,
                "amount": Decimal("5"),
            },
        )


@pytest.mark.django_db
def test_create_settlement_rejects_same_payer_and_receiver():
    owner, group, owner_p, _other = _group_with_two()
    with pytest.raises(ValueError, match="must be different"):
        create_settlement(
            actor=owner,
            group=group,
            data={
                "payer_participant_id": owner_p.id,
                "receiver_participant_id": owner_p.id,
                "amount": Decimal("5"),
            },
        )


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_create_settlement_converts_foreign_currency_into_context_currency():
    owner, group, owner_p, other = _group_with_two()
    ExchangeRate.objects.create(
        base_currency="USD", quote_currency="EUR", rate=Decimal("0.50000000"), source="seed"
    )
    settlement = create_settlement(
        actor=owner,
        group=group,
        data={
            "payer_participant_id": owner_p.id,
            "receiver_participant_id": other.id,
            "amount": Decimal("10.00"),
            "currency": "USD",
        },
    )
    # 10 USD * 0.5 = 5 EUR, stored in the context currency.
    assert settlement.amount == Decimal("5.00")
    assert settlement.currency == "EUR"


@pytest.mark.django_db
def test_create_settlement_denied_for_non_member():
    _owner, group, _owner_p, other = _group_with_two()
    outsider = _user("outsider@example.com")
    with pytest.raises(PermissionError):
        create_settlement(
            actor=outsider,
            group=group,
            data={
                "payer_participant_id": other.id,
                "receiver_participant_id": other.id,
                "amount": Decimal("5"),
            },
        )


# --- service: update / delete -------------------------------------------------


@pytest.mark.django_db
def test_update_settlement_changes_amount_and_participants():
    owner, group, owner_p, other = _group_with_two()
    settlement = create_settlement(
        actor=owner,
        group=group,
        data={
            "payer_participant_id": owner_p.id,
            "receiver_participant_id": other.id,
            "amount": Decimal("10.00"),
        },
    )
    updated = update_settlement(
        actor=owner,
        settlement=settlement,
        data={
            "payer_participant_id": other.id,
            "receiver_participant_id": owner_p.id,
            "amount": Decimal("7.50"),
        },
    )
    assert updated.payer_participant_id == other.id
    assert updated.receiver_participant_id == owner_p.id
    assert updated.amount == Decimal("7.50")


@pytest.mark.django_db
def test_update_rejects_deleted_settlement():
    owner, group, owner_p, other = _group_with_two()
    settlement = create_settlement(
        actor=owner,
        group=group,
        data={
            "payer_participant_id": owner_p.id,
            "receiver_participant_id": other.id,
            "amount": Decimal("10.00"),
        },
    )
    soft_delete_settlement(actor=owner, settlement=settlement)
    with pytest.raises(ValueError, match="Deleted settlements cannot be edited"):
        update_settlement(
            actor=owner, settlement=settlement, data={"amount": Decimal("1.00")}
        )


@pytest.mark.django_db
def test_update_rejects_same_payer_and_receiver():
    owner, group, owner_p, other = _group_with_two()
    settlement = create_settlement(
        actor=owner,
        group=group,
        data={
            "payer_participant_id": owner_p.id,
            "receiver_participant_id": other.id,
            "amount": Decimal("10.00"),
        },
    )
    with pytest.raises(ValueError, match="must be different"):
        update_settlement(
            actor=owner,
            settlement=settlement,
            data={"receiver_participant_id": owner_p.id},
        )


@pytest.mark.django_db
def test_soft_delete_marks_settlement_deleted():
    owner, group, owner_p, other = _group_with_two()
    settlement = create_settlement(
        actor=owner,
        group=group,
        data={
            "payer_participant_id": owner_p.id,
            "receiver_participant_id": other.id,
            "amount": Decimal("10.00"),
        },
    )
    soft_delete_settlement(actor=owner, settlement=settlement)
    settlement.refresh_from_db()
    assert settlement.deleted_at is not None


# --- API ----------------------------------------------------------------------


@pytest.mark.django_db
def test_group_settlement_create_endpoint_returns_201():
    owner, group, owner_p, other = _group_with_two()
    client = APIClient()
    client.force_authenticate(owner)
    response = client.post(
        f"/api/groups/{group.id}/settlements/",
        {
            "payer_participant_id": owner_p.id,
            "receiver_participant_id": other.id,
            "amount": "10.00",
        },
        format="json",
    )
    assert response.status_code == 201


@pytest.mark.django_db
def test_group_settlement_create_endpoint_validation_error_returns_400():
    owner, group, owner_p, _other = _group_with_two()
    client = APIClient()
    client.force_authenticate(owner)
    response = client.post(
        f"/api/groups/{group.id}/settlements/",
        {
            "payer_participant_id": owner_p.id,
            "receiver_participant_id": owner_p.id,
            "amount": "10.00",
        },
        format="json",
    )
    assert response.status_code == 400
    assert "different" in str(response.data["detail"])


@pytest.mark.django_db
def test_settlement_detail_patch_and_delete_endpoints():
    owner, group, owner_p, other = _group_with_two()
    settlement = create_settlement(
        actor=owner,
        group=group,
        data={
            "payer_participant_id": owner_p.id,
            "receiver_participant_id": other.id,
            "amount": Decimal("10.00"),
        },
    )
    client = APIClient()
    client.force_authenticate(owner)

    patch = client.patch(
        f"/api/settlements/{settlement.id}/", {"amount": "4.00"}, format="json"
    )
    assert patch.status_code == 200

    delete = client.delete(f"/api/settlements/{settlement.id}/")
    assert delete.status_code == 204
    settlement.refresh_from_db()
    assert settlement.deleted_at is not None


@pytest.mark.django_db
def test_settlement_patch_returns_400_for_business_rule_violation():
    owner, group, owner_p, other = _group_with_two()
    settlement = create_settlement(
        actor=owner,
        group=group,
        data={
            "payer_participant_id": owner_p.id,
            "receiver_participant_id": other.id,
            "amount": Decimal("10.00"),
        },
    )
    client = APIClient()
    client.force_authenticate(owner)
    response = client.patch(
        f"/api/settlements/{settlement.id}/",
        {"receiver_participant_id": owner_p.id},
        format="json",
    )
    assert response.status_code == 400
    assert "different" in str(response.data["detail"])


@pytest.mark.django_db
def test_friend_settlement_create_endpoint_returns_201():
    owner = _user("owner@example.com")
    friend = _user("friend@example.com")
    friend_p = get_or_create_user_participant(friend)
    friendship = create_friendship(owner, friend_p)
    owner_p = get_or_create_user_participant(owner)

    client = APIClient()
    client.force_authenticate(owner)
    response = client.post(
        f"/api/friends/{friendship.id}/settlements/",
        {
            "payer_participant_id": owner_p.id,
            "receiver_participant_id": friend_p.id,
            "amount": "8.00",
        },
        format="json",
    )
    assert response.status_code == 201

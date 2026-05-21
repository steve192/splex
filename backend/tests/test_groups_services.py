import pytest
from django.contrib.auth import get_user_model

from splex.activity.models import ActivityEvent
from splex.groups.models import GroupMembership
from splex.groups.services import (
    add_registered_participant,
    add_unregistered_participant,
    create_group,
    delete_group,
    remove_group_participant,
    rename_unregistered_participant,
    update_group,
)
from splex.friends.services import create_friendship
from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant


@pytest.mark.django_db
def test_create_group_records_activity_and_makes_actor_admin():
    user_model = get_user_model()
    user = user_model.objects.create_user(email="creator@example.com", display_name="Creator")
    group = create_group(actor=user, name="Trip", default_currency="EUR")

    assert group.default_currency == "EUR"
    participant = get_or_create_user_participant(user)
    membership = GroupMembership.objects.get(group=group, participant=participant)
    assert membership.role == GroupMembership.Role.ADMIN
    assert ActivityEvent.objects.filter(group=group, event_type="group.created").exists()


@pytest.mark.django_db
def test_add_unregistered_participant_stores_target_id_in_payload():
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U")
    group = create_group(actor=user, name="Trip", default_currency="EUR")
    participant = add_unregistered_participant(actor=user, group=group, display_name="Ghost")

    assert participant.kind == Participant.Kind.UNREGISTERED
    event = ActivityEvent.objects.get(event_type="group.member_added", group=group)
    assert event.payload == {"target_participant_id": participant.id}


@pytest.mark.django_db
def test_add_registered_participant_adds_existing_friend_to_group():
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com", display_name="Owner")
    friend_user = user_model.objects.create_user(email="friend@example.com", display_name="Friend")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    friend_participant = get_or_create_user_participant(friend_user)
    create_friendship(owner, friend_participant)

    participant = add_registered_participant(actor=owner, group=group, participant=friend_participant)

    membership = GroupMembership.objects.get(group=group, participant=participant)
    assert membership.removed_at is None
    event = ActivityEvent.objects.get(event_type="group.member_added", group=group)
    assert event.payload == {"target_participant_id": participant.id}


@pytest.mark.django_db
def test_rename_only_works_for_unregistered_participants():
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U")
    group = create_group(actor=user, name="Trip", default_currency="EUR")
    registered = get_or_create_user_participant(user)

    with pytest.raises(ValueError, match="Only unregistered"):
        rename_unregistered_participant(
            actor=user, group=group, participant=registered, display_name="Renamed"
        )


@pytest.mark.django_db
def test_rename_unregistered_participant_keeps_old_name_in_payload():
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U")
    group = create_group(actor=user, name="Trip", default_currency="EUR")
    p = add_unregistered_participant(actor=user, group=group, display_name="Bob")

    rename_unregistered_participant(actor=user, group=group, participant=p, display_name="Robert")

    p.refresh_from_db()
    assert p.display_name == "Robert"
    event = ActivityEvent.objects.get(event_type="group.member_renamed")
    assert event.payload["oldName"] == "Bob"
    assert event.payload["target_participant_id"] == p.id


@pytest.mark.django_db
def test_cannot_remove_yourself_via_remove_participant():
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U")
    group = create_group(actor=user, name="Trip", default_currency="EUR")
    p = get_or_create_user_participant(user)
    with pytest.raises(ValueError, match="cannot remove yourself"):
        remove_group_participant(actor=user, group=group, participant=p)


@pytest.mark.django_db
def test_remove_participant_auto_settles_outstanding_debt():
    """When a participant with a non-zero balance is removed, the system creates
    settlements to bring the balance to zero before marking membership removed."""
    from splex.expenses.services import create_expense
    from splex.settlements.models import Settlement

    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    placeholder = add_unregistered_participant(actor=owner, group=group, display_name="Bob")
    owner_p = get_or_create_user_participant(owner)

    # Owner paid 10 EUR for both → Bob owes Owner 5 EUR.
    create_expense(
        actor=owner,
        group=group,
        data={
            "description": "Pizza",
            "amount": "10",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [{"participant_id": owner_p.id, "amount": "10"}],
        },
    )

    assert not Settlement.objects.filter(group=group).exists()
    remove_group_participant(actor=owner, group=group, participant=placeholder)

    settlements = list(Settlement.objects.filter(group=group))
    assert len(settlements) == 1
    settlement = settlements[0]
    assert settlement.payer_participant_id == placeholder.id
    assert settlement.receiver_participant_id == owner_p.id
    assert str(settlement.amount) == "5.00"

    event = ActivityEvent.objects.get(event_type="group.member_removed", group=group)
    assert event.payload["autoSettled"] == 1


@pytest.mark.django_db
def test_remove_participant_skips_settlement_when_balance_zero():
    from splex.settlements.models import Settlement

    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    placeholder = add_unregistered_participant(actor=owner, group=group, display_name="Bob")

    remove_group_participant(actor=owner, group=group, participant=placeholder)
    assert not Settlement.objects.filter(group=group).exists()
    event = ActivityEvent.objects.get(event_type="group.member_removed", group=group)
    assert event.payload["autoSettled"] == 0


@pytest.mark.django_db
def test_delete_group_is_idempotent():
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U")
    group = create_group(actor=user, name="Trip", default_currency="EUR")
    delete_group(actor=user, group=group)
    group.refresh_from_db()
    first_deletion = group.deleted_at
    delete_group(actor=user, group=group)
    group.refresh_from_db()
    assert group.deleted_at == first_deletion  # unchanged


@pytest.mark.django_db
def test_update_group_blocks_currency_change_when_ledger_exists():
    user_model = get_user_model()
    user = user_model.objects.create_user(email="u@example.com", display_name="U")
    group = create_group(actor=user, name="Trip", default_currency="EUR")
    add_unregistered_participant(actor=user, group=group, display_name="Bob")

    # Create at least one expense to lock currency.
    from splex.expenses.services import create_expense

    actor_p = get_or_create_user_participant(user)
    create_expense(
        actor=user,
        group=group,
        data={
            "description": "A",
            "amount": "10",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [{"participant_id": actor_p.id, "amount": "10"}],
        },
    )
    with pytest.raises(ValueError, match="currency cannot be changed"):
        update_group(actor=user, group=group, data={"default_currency": "USD"})

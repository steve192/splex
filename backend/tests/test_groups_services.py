import pytest
from django.contrib.auth import get_user_model

from splex.activity.models import ActivityEvent
from splex.groups.models import GroupMembership
from splex.groups.services import (
    add_registered_participant,
    add_unregistered_participant,
    create_group,
    delete_group,
    leave_group,
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
def test_remove_participant_converts_to_unregistered_placeholder():
    """Removing a participant creates an unregistered placeholder that inherits
    the membership and all expense shares in the group.  No settlement is created."""
    from splex.expenses.services import create_expense
    from splex.expenses.models import ExpenseOwedShare, ExpensePaymentShare
    from splex.settlements.models import Settlement

    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com", display_name="Owner")
    other = user_model.objects.create_user(email="other@example.com", display_name="Other")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    other_participant = get_or_create_user_participant(other)
    GroupMembership.objects.create(group=group, participant=other_participant)
    owner_p = get_or_create_user_participant(owner)

    # Owner paid 10 EUR for both → other owes owner 5 EUR.
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

    remove_group_participant(actor=owner, group=group, participant=other_participant)

    # No settlements should have been created.
    assert not Settlement.objects.filter(group=group).exists()

    # A new unregistered placeholder should exist in the group.
    placeholder = Participant.objects.filter(
        kind=Participant.Kind.UNREGISTERED,
        group_memberships__group=group,
        group_memberships__removed_at__isnull=True,
    ).exclude(id=owner_p.id).first()
    assert placeholder is not None
    assert placeholder.display_name == "Other"

    # The original participant's membership should be transferred (not removed separately).
    assert not GroupMembership.objects.filter(
        group=group, participant=other_participant, removed_at__isnull=True
    ).exists()

    # Expense shares should now belong to the placeholder.
    assert not ExpenseOwedShare.objects.filter(participant=other_participant).exists()
    assert ExpenseOwedShare.objects.filter(participant=placeholder).exists()


@pytest.mark.django_db
def test_remove_participant_without_balance_still_converts_to_placeholder():
    """Even with no outstanding balance the participant is converted to an
    unregistered placeholder (not simply removed)."""
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com", display_name="Owner")
    other = user_model.objects.create_user(email="other@example.com", display_name="Other")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    other_participant = get_or_create_user_participant(other)
    GroupMembership.objects.create(group=group, participant=other_participant)

    remove_group_participant(actor=owner, group=group, participant=other_participant)

    # Placeholder exists in group.
    placeholder_qs = Participant.objects.filter(
        kind=Participant.Kind.UNREGISTERED,
        group_memberships__group=group,
        group_memberships__removed_at__isnull=True,
    )
    assert placeholder_qs.exists()
    assert placeholder_qs.first().display_name == "Other"

    event = ActivityEvent.objects.get(event_type="group.member_removed", group=group)
    assert "target_participant_id" in event.payload


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
def test_leave_group_converts_to_placeholder_when_others_remain():
    """Leaving a group converts the leaver to an unregistered placeholder; the
    other registered member's membership stays active."""
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com", display_name="Owner")
    other = user_model.objects.create_user(email="other@example.com", display_name="Other")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    other_participant = get_or_create_user_participant(other)
    GroupMembership.objects.create(group=group, participant=other_participant)

    leave_group(actor=owner, group=group)

    # Owner's original participant no longer has an active membership in this group.
    owner_participant = get_or_create_user_participant(owner)
    assert not GroupMembership.objects.filter(
        group=group, participant=owner_participant, removed_at__isnull=True
    ).exists()

    # A placeholder was created and is an active member.
    placeholder_qs = Participant.objects.filter(
        kind=Participant.Kind.UNREGISTERED,
        group_memberships__group=group,
        group_memberships__removed_at__isnull=True,
    )
    assert placeholder_qs.exists()
    assert placeholder_qs.first().display_name == "Owner"

    # The other member is unaffected.
    assert GroupMembership.objects.get(group=group, participant=other_participant).removed_at is None


@pytest.mark.django_db
def test_leave_group_deletes_group_for_last_member():
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")

    leave_group(actor=owner, group=group)

    group.refresh_from_db()
    assert group.deleted_at is not None


@pytest.mark.django_db
def test_leave_group_deletes_group_when_only_unregistered_members_remain():
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    add_unregistered_participant(actor=owner, group=group, display_name="Ghost")

    leave_group(actor=owner, group=group)

    group.refresh_from_db()
    assert group.deleted_at is not None


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

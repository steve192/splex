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
from splex.friends.models import Friendship
from splex.friends.services import accessible_friendships, create_friendship
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
def test_create_friendship_is_idempotent():
    """Calling create_friendship for an already-friends pair returns the
    existing row without creating a second friendship or recording another
    FRIEND_ACCEPTED activity event."""
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com", display_name="Owner")
    friend_user = user_model.objects.create_user(email="friend@example.com", display_name="Friend")
    friend_participant = get_or_create_user_participant(friend_user)

    first = create_friendship(owner, friend_participant)
    second = create_friendship(owner, friend_participant)
    assert first.id == second.id

    a, b = sorted([
        get_or_create_user_participant(owner).id,
        friend_participant.id,
    ])
    assert Friendship.objects.filter(
        participant_a_id=a, participant_b_id=b, ended_at__isnull=True
    ).count() == 1
    assert ActivityEvent.objects.filter(event_type="friend.accepted").count() == 1


@pytest.mark.django_db
def test_db_constraint_blocks_two_active_friendships_for_same_pair():
    """Defense in depth: even if a code path tried to bypass the service
    layer, the database itself rejects a second active row for a pair."""
    from django.db import IntegrityError

    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com")
    friend_user = user_model.objects.create_user(email="friend@example.com")
    a_p = get_or_create_user_participant(owner)
    b_p = get_or_create_user_participant(friend_user)
    a, b = sorted([a_p, b_p], key=lambda p: p.id)
    Friendship.objects.create(
        participant_a=a, participant_b=b, source=Friendship.Source.EXPLICIT, default_currency="EUR"
    )
    with pytest.raises(IntegrityError):
        Friendship.objects.create(
            participant_a=a,
            participant_b=b,
            source=Friendship.Source.SHARED_GROUP,
            default_currency="EUR",
        )


@pytest.mark.django_db
def test_adding_existing_friend_to_group_does_not_create_duplicate_friendship():
    """Regression: an EXPLICIT friendship from a friend invite must not be
    paired with a second SHARED_GROUP row when the friend is later added to
    a group - otherwise /api/friends/ would list them twice."""
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com", display_name="Owner")
    friend_user = user_model.objects.create_user(email="friend@example.com", display_name="Friend")
    friend_participant = get_or_create_user_participant(friend_user)
    create_friendship(owner, friend_participant)
    assert accessible_friendships(owner).count() == 1

    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    add_registered_participant(actor=owner, group=group, participant=friend_participant)

    friendships = list(accessible_friendships(owner))
    assert len(friendships) == 1
    # The pre-existing EXPLICIT friendship must be preserved, not overwritten.
    assert friendships[0].source == Friendship.Source.EXPLICIT


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
def test_delete_group_blocked_while_balance_outstanding():
    """A group cannot be deleted while a pair still owes money, mirroring friend
    removal - deletion must never silently drop an unsettled balance."""
    from splex.expenses.services import create_expense

    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    add_unregistered_participant(actor=owner, group=group, display_name="Bob")
    owner_p = get_or_create_user_participant(owner)

    # Owner paid 20 EUR for both → Bob owes Owner 10 EUR.
    create_expense(
        actor=owner,
        group=group,
        data={
            "description": "Dinner",
            "amount": "20",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [{"participant_id": owner_p.id, "amount": "20"}],
        },
    )

    with pytest.raises(ValueError, match="Settle up"):
        delete_group(actor=owner, group=group)

    group.refresh_from_db()
    assert group.deleted_at is None


@pytest.mark.django_db
def test_delete_group_allowed_once_settled():
    """Once the outstanding balance is settled, deletion proceeds."""
    from splex.expenses.services import create_expense
    from splex.settlements.services import create_settlement

    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    bob = add_unregistered_participant(actor=owner, group=group, display_name="Bob")
    owner_p = get_or_create_user_participant(owner)

    create_expense(
        actor=owner,
        group=group,
        data={
            "description": "Dinner",
            "amount": "20",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [{"participant_id": owner_p.id, "amount": "20"}],
        },
    )
    # Bob pays Owner the 10 EUR they owe → group nets to zero.
    create_settlement(
        actor=owner,
        group=group,
        data={
            "payer_participant_id": bob.id,
            "receiver_participant_id": owner_p.id,
            "amount": "10",
            "currency": "EUR",
        },
    )

    delete_group(actor=owner, group=group)

    group.refresh_from_db()
    assert group.deleted_at is not None


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
def test_leave_group_as_last_member_succeeds_with_outstanding_placeholder_balance():
    """The last member can always leave (which deletes the group), even with an
    unsettled balance against an unregistered placeholder - unlike an explicit
    delete, leaving is not gated on settling up."""
    from splex.expenses.services import create_expense

    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    add_unregistered_participant(actor=owner, group=group, display_name="Bob")
    owner_p = get_or_create_user_participant(owner)
    # Owner paid 20 for both → Bob (placeholder) owes Owner 10; group is unsettled.
    create_expense(
        actor=owner,
        group=group,
        data={
            "description": "Dinner",
            "amount": "20",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [{"participant_id": owner_p.id, "amount": "20"}],
        },
    )

    # An explicit delete is refused while unsettled...
    with pytest.raises(ValueError, match="Settle up"):
        delete_group(actor=owner, group=group)

    # ...but leaving as the last member still works and deletes the group.
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


@pytest.mark.django_db
def test_remove_unregistered_participant_with_balance_settles_then_soft_deletes():
    """Removing an unregistered member zeroes out their balance via auto-settlements
    and soft-deletes the participant so historical expenses keep resolving the name."""
    from splex.expenses.services import create_expense
    from splex.settlements.models import Settlement

    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    bob = add_unregistered_participant(actor=owner, group=group, display_name="Bob")
    owner_p = get_or_create_user_participant(owner)

    # Owner paid 20 EUR for both → Bob owes Owner 10 EUR.
    create_expense(
        actor=owner,
        group=group,
        data={
            "description": "Dinner",
            "amount": "20",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [{"participant_id": owner_p.id, "amount": "20"}],
        },
    )

    remove_group_participant(actor=owner, group=group, participant=bob)

    # A settlement should have been created paying Bob → Owner for 10 EUR,
    # tagged as an auto write-off so the ledger renders it distinctly.
    settlements = Settlement.objects.filter(group=group)
    assert settlements.count() == 1
    settlement = settlements.first()
    assert settlement.payer_participant_id == bob.id
    assert settlement.receiver_participant_id == owner_p.id
    assert str(settlement.amount) == "10.00"
    assert settlement.kind == Settlement.Kind.AUTO_WRITE_OFF

    # Membership is removed.
    membership = GroupMembership.objects.get(group=group, participant=bob)
    assert membership.removed_at is not None

    # Participant row is soft-deleted but still exists so old expenses display the name.
    bob.refresh_from_db()
    assert bob.deleted_at is not None
    assert bob.effective_display_name == "Bob"


@pytest.mark.django_db
def test_remove_unregistered_participant_with_zero_balance_skips_settlement():
    """No balance → just remove the membership and soft-delete the participant."""
    from splex.settlements.models import Settlement

    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    bob = add_unregistered_participant(actor=owner, group=group, display_name="Bob")

    remove_group_participant(actor=owner, group=group, participant=bob)

    assert not Settlement.objects.filter(group=group).exists()
    bob.refresh_from_db()
    assert bob.deleted_at is not None
    assert GroupMembership.objects.get(group=group, participant=bob).removed_at is not None

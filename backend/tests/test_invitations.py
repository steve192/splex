import pytest
from django.contrib.auth import get_user_model

from splex.friends.models import Friendship
from splex.groups.models import GroupMembership
from splex.groups.services import add_unregistered_participant, create_group, remove_group_participant
from splex.invitations.services import (
    accept_invitation,
    create_claim_invitation,
    create_friend_invitation,
    create_group_invitation,
)
from splex.participants.services import get_or_create_user_participant


@pytest.mark.django_db
def test_group_invitation_can_only_be_accepted_once():
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com")
    invitee = user_model.objects.create_user(email="invitee@example.com")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    _, token, _ = create_group_invitation(actor=owner, group=group)

    accept_invitation(actor=invitee, token=token)
    with pytest.raises(ValueError, match="invalid or expired"):
        accept_invitation(actor=invitee, token=token)


@pytest.mark.django_db
def test_group_invitation_does_not_create_duplicate_memberships():
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com")
    invitee = user_model.objects.create_user(email="invitee@example.com")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    _, token, _ = create_group_invitation(actor=owner, group=group)

    accept_invitation(actor=invitee, token=token)

    participant = get_or_create_user_participant(invitee)
    memberships = GroupMembership.objects.filter(group=group, participant=participant, removed_at__isnull=True)
    assert memberships.count() == 1


@pytest.mark.django_db
def test_friend_invitation_does_not_create_duplicate_friendships():
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com")
    invitee = user_model.objects.create_user(email="invitee@example.com")

    _, token_one, _ = create_friend_invitation(actor=owner)
    accept_invitation(actor=invitee, token=token_one)
    _, token_two, _ = create_friend_invitation(actor=owner)
    accept_invitation(actor=invitee, token=token_two)

    a = get_or_create_user_participant(owner)
    b = get_or_create_user_participant(invitee)
    first, second = sorted([a.id, b.id])
    assert Friendship.objects.filter(
        participant_a_id=first,
        participant_b_id=second,
        ended_at__isnull=True,
    ).count() == 1


@pytest.mark.django_db
def test_claim_invitation_cannot_be_reclaimed_by_another_user():
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com")
    claimer = user_model.objects.create_user(email="claimer@example.com")
    other = user_model.objects.create_user(email="other@example.com")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    placeholder = add_unregistered_participant(actor=owner, group=group, display_name="Alex")
    _, token, _ = create_claim_invitation(actor=owner, group=group, target_participant=placeholder)

    accept_invitation(actor=claimer, token=token)
    with pytest.raises(ValueError, match="invalid or expired"):
        accept_invitation(actor=other, token=token)


@pytest.mark.django_db
def test_claim_invitation_merges_existing_removed_member_participant():
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com")
    removed_user = user_model.objects.create_user(email="removed@example.com")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")

    existing_participant = get_or_create_user_participant(removed_user)
    GroupMembership.objects.create(group=group, participant=existing_participant)
    remove_group_participant(actor=owner, group=group, participant=existing_participant)

    placeholder = add_unregistered_participant(actor=owner, group=group, display_name="Removed User")
    _, token, _ = create_claim_invitation(actor=owner, group=group, target_participant=placeholder)

    accept_invitation(actor=removed_user, token=token)

    removed_user.refresh_from_db()
    placeholder.refresh_from_db()
    existing_participant.refresh_from_db()

    assert removed_user.participant.id == placeholder.id
    assert placeholder.user_id == removed_user.id
    assert placeholder.kind == placeholder.Kind.REGISTERED
    assert existing_participant.user_id is None

    memberships = GroupMembership.objects.filter(group=group, participant=placeholder)
    assert memberships.count() == 1
    assert memberships.get().removed_at is None


@pytest.mark.django_db
def test_accepting_a_second_group_invite_is_a_no_op_for_active_member():
    """Accepting a fresh invite to a group you're already an active member of
    must not create a second membership and must not raise."""
    from splex.activity.models import ActivityEvent

    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com")
    invitee = user_model.objects.create_user(email="invitee@example.com")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")

    _, token_one, _ = create_group_invitation(actor=owner, group=group)
    accept_invitation(actor=invitee, token=token_one)
    _, token_two, _ = create_group_invitation(actor=owner, group=group)
    accept_invitation(actor=invitee, token=token_two)

    invitee_p = get_or_create_user_participant(invitee)
    assert GroupMembership.objects.filter(group=group, participant=invitee_p).count() == 1
    # The second accept is a silent no-op - no duplicate "joined" activity event.
    joined_events = ActivityEvent.objects.filter(
        group=group, event_type="group.member_joined"
    )
    assert joined_events.count() == 1

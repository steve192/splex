import pytest
from django.contrib.auth import get_user_model

from splex.friends.models import Friendship
from splex.groups.models import GroupMembership
from splex.groups.services import add_unregistered_participant, create_group
from splex.invitations.services import (
    accept_invitation,
    create_claim_invitation,
    create_friend_invitation,
    create_group_invitation,
)
from splex.participants.services import get_or_create_user_participant


@pytest.mark.django_db
def test_group_invitation_can_only_be_accepted_once():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com")
    invitee = User.objects.create_user(email="invitee@example.com")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    _, token, _ = create_group_invitation(actor=owner, group=group)

    accept_invitation(actor=invitee, token=token)
    with pytest.raises(ValueError, match="invalid or expired"):
        accept_invitation(actor=invitee, token=token)


@pytest.mark.django_db
def test_group_invitation_does_not_create_duplicate_memberships():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com")
    invitee = User.objects.create_user(email="invitee@example.com")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    _, token, _ = create_group_invitation(actor=owner, group=group)

    accept_invitation(actor=invitee, token=token)

    participant = get_or_create_user_participant(invitee)
    memberships = GroupMembership.objects.filter(group=group, participant=participant, removed_at__isnull=True)
    assert memberships.count() == 1


@pytest.mark.django_db
def test_friend_invitation_does_not_create_duplicate_friendships():
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com")
    invitee = User.objects.create_user(email="invitee@example.com")

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
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com")
    claimer = User.objects.create_user(email="claimer@example.com")
    other = User.objects.create_user(email="other@example.com")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    placeholder = add_unregistered_participant(actor=owner, group=group, display_name="Alex")
    _, token, _ = create_claim_invitation(actor=owner, group=group, target_participant=placeholder)

    accept_invitation(actor=claimer, token=token)
    with pytest.raises(ValueError, match="invalid or expired"):
        accept_invitation(actor=other, token=token)

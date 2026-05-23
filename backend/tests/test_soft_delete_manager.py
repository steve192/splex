"""Smoke tests for SoftDeletableManager - confirms `.active()` / `.inactive()`
respect each model's `SOFT_DELETE_FIELD`. New code paths should prefer these
helpers over re-typing the filter inline."""

from datetime import datetime, timezone

import pytest
from django.contrib.auth import get_user_model

from splex.friends.models import Friendship
from splex.friends.services import create_friendship
from splex.groups.models import Group, GroupMembership
from splex.groups.services import create_group
from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant


@pytest.mark.django_db
def test_participant_active_excludes_soft_deleted_rows():
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    ghost = Participant.objects.create(
        display_name="Ghost",
        kind=Participant.Kind.UNREGISTERED,
        deleted_at=datetime(2026, 5, 1, tzinfo=timezone.utc),
    )

    # Use `id__in` to scope to test data and avoid clashing with whatever the
    # fixtures pulled in.
    owner_p = get_or_create_user_participant(owner)
    scope = Participant.objects.filter(id__in=[owner_p.id, ghost.id])
    assert scope.active().count() == 1
    assert scope.inactive().count() == 1
    assert scope.count() == 2  # default manager keeps both
    _ = group  # silence unused warning


@pytest.mark.django_db
def test_group_membership_active_excludes_removed():
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    membership = GroupMembership.objects.get(group=group)
    assert GroupMembership.objects.filter(group=group).active().count() == 1
    membership.removed_at = datetime(2026, 5, 1, tzinfo=timezone.utc)
    membership.save(update_fields=["removed_at"])
    assert GroupMembership.objects.filter(group=group).active().count() == 0
    assert GroupMembership.objects.filter(group=group).inactive().count() == 1


@pytest.mark.django_db
def test_friendship_active_uses_ended_at():
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com")
    other = user_model.objects.create_user(email="other@example.com")
    other_p = get_or_create_user_participant(other)
    friendship = create_friendship(owner, other_p)
    assert Friendship.objects.active().filter(id=friendship.id).exists()

    friendship.ended_at = datetime(2026, 5, 1, tzinfo=timezone.utc)
    friendship.save(update_fields=["ended_at"])
    assert not Friendship.objects.active().filter(id=friendship.id).exists()
    assert Friendship.objects.inactive().filter(id=friendship.id).exists()


@pytest.mark.django_db
def test_group_active_excludes_deleted_but_includes_archived():
    """Group has both `archived_at` and `deleted_at`; only `deleted_at` qualifies
    as a soft delete. Archived groups remain active so users can still browse them."""
    user_model = get_user_model()
    owner = user_model.objects.create_user(email="owner@example.com")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    archived = create_group(actor=owner, name="Old", default_currency="EUR")
    archived.archived_at = datetime(2026, 5, 1, tzinfo=timezone.utc)
    archived.save(update_fields=["archived_at"])
    deleted = create_group(actor=owner, name="Gone", default_currency="EUR")
    deleted.deleted_at = datetime(2026, 5, 1, tzinfo=timezone.utc)
    deleted.save(update_fields=["deleted_at"])

    active_ids = set(Group.objects.active().values_list("id", flat=True))
    assert group.id in active_ids
    assert archived.id in active_ids
    assert deleted.id not in active_ids

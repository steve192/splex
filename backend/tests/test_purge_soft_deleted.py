from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone

from splex.activity.models import ActivityEvent
from splex.expenses.models import Expense
from splex.expenses.services import create_expense
from splex.friends.models import Friendship
from splex.friends.services import create_friendship, end_friendship
from splex.groups.models import Group
from splex.groups.services import add_unregistered_participant, create_group, delete_group
from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant


def _age(model_cls, pk, field, days):
    """Backdate a soft-delete timestamp without tripping auto_now on updated_at."""
    model_cls.objects.filter(pk=pk).update(**{field: timezone.now() - timedelta(days=days)})


@pytest.mark.django_db
def test_purge_removes_old_deleted_group_and_its_ledger(settings):
    settings.DATA_RETENTION_INACTIVE_MONTHS = 6  # ~180 day cutoff
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    owner_p = get_or_create_user_participant(owner)
    create_expense(
        actor=owner,
        group=group,
        data={
            "description": "Dinner",
            "amount": "10",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [{"participant_id": owner_p.id, "amount": "10"}],
        },
    )
    delete_group(actor=owner, group=group)
    _age(Group, group.id, "deleted_at", days=200)
    assert ActivityEvent.objects.filter(group_id=group.id).exists()

    call_command("purge_soft_deleted")

    assert not Group.objects.filter(id=group.id).exists()
    # The group's expenses cascade away with it.
    assert not Expense.objects.filter(group_id=group.id).exists()
    # ...but its activity history survives as context-less rows (FK SET_NULL),
    # still reachable by the actor who performed them.
    assert ActivityEvent.objects.filter(actor=owner, group_id__isnull=True).exists()
    assert not ActivityEvent.objects.filter(group_id=group.id).exists()


@pytest.mark.django_db
def test_purge_keeps_recently_deleted_group(settings):
    settings.DATA_RETENTION_INACTIVE_MONTHS = 6
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    delete_group(actor=owner, group=group)  # deleted_at = now, within retention

    call_command("purge_soft_deleted")

    assert Group.objects.filter(id=group.id).exists()


@pytest.mark.django_db
def test_purge_removes_old_ended_friendship(settings):
    settings.DATA_RETENTION_INACTIVE_MONTHS = 6
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    friend = User.objects.create_user(email="friend@example.com", display_name="Friend")
    friendship = create_friendship(owner, get_or_create_user_participant(friend))
    end_friendship(owner, friendship, get_or_create_user_participant(owner))
    _age(Friendship, friendship.id, "ended_at", days=200)

    call_command("purge_soft_deleted")

    assert not Friendship.objects.filter(id=friendship.id).exists()
    # The FRIEND_REMOVED (and FRIEND_ACCEPTED) events survive with friendship=NULL.
    assert ActivityEvent.objects.filter(actor=owner, friendship_id__isnull=True).exists()
    assert not ActivityEvent.objects.filter(friendship_id=friendship.id).exists()


@pytest.mark.django_db
def test_purge_keeps_soft_deleted_participant_referenced_by_live_expense(settings):
    """A removed registered member becomes a soft-deleted placeholder still
    referenced by active expenses - it must survive the purge (PROTECT)."""
    from splex.groups.services import remove_group_participant

    settings.DATA_RETENTION_INACTIVE_MONTHS = 6
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    member = User.objects.create_user(email="member@example.com", display_name="Member")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    member_p = get_or_create_user_participant(member)
    from splex.groups.models import GroupMembership

    GroupMembership.objects.create(group=group, participant=member_p)
    owner_p = get_or_create_user_participant(owner)
    create_expense(
        actor=owner,
        group=group,
        data={
            "description": "Dinner",
            "amount": "10",
            "currency": "EUR",
            "split_method": "equal_all",
            "payments": [{"participant_id": owner_p.id, "amount": "10"}],
        },
    )
    # Removing the registered member converts them to a soft-deleted placeholder.
    remove_group_participant(actor=owner, group=group, participant=member_p)
    placeholder = Participant.objects.exclude(id__in=[owner_p.id, member_p.id]).get()
    _age(Participant, placeholder.id, "deleted_at", days=400)

    call_command("purge_soft_deleted")

    # The group is still active, so it stays; the placeholder participant is
    # retained (referenced PROTECT by the live expense) rather than purged.
    assert Group.objects.filter(id=group.id).exists()
    assert Participant.objects.filter(id=placeholder.id).exists()


@pytest.mark.django_db
def test_purge_disabled_when_retention_zero(settings):
    settings.DATA_RETENTION_INACTIVE_MONTHS = 0
    User = get_user_model()
    owner = User.objects.create_user(email="owner@example.com", display_name="Owner")
    group = create_group(actor=owner, name="Trip", default_currency="EUR")
    delete_group(actor=owner, group=group)
    _age(Group, group.id, "deleted_at", days=9999)

    call_command("purge_soft_deleted")

    # Disabled → even an ancient soft-deleted group is kept.
    assert Group.objects.filter(id=group.id).exists()

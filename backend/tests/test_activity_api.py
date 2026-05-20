import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from splex.groups.models import GroupMembership
from splex.groups.services import add_unregistered_participant, create_group
from splex.participants.services import get_or_create_user_participant
from splex.settlements.services import create_settlement


def _auth_client(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _add_user_to_group(user, group):
    GroupMembership.objects.create(group=group, participant=get_or_create_user_participant(user))


@pytest.mark.django_db
def test_activity_list_returns_subject_name_from_target_participant_id():
    User = get_user_model()
    actor = User.objects.create_user(email="actor@example.com", display_name="Actor")
    other = User.objects.create_user(email="other@example.com", display_name="Other")
    group = create_group(actor=actor, name="Trip", default_currency="EUR")
    _add_user_to_group(other, group)
    placeholder = add_unregistered_participant(actor=actor, group=group, display_name="Bob")

    client = _auth_client(other)
    response = client.get("/api/activity/")
    assert response.status_code == 200
    member_added = next(
        row for row in response.data["results"] if row["event_type"] == "group.member_added"
    )
    assert member_added["subject_name"] == "Bob"
    assert member_added["payload"]["target_participant_id"] == placeholder.id


@pytest.mark.django_db
def test_subject_name_reflects_live_rename():
    User = get_user_model()
    actor = User.objects.create_user(email="actor@example.com", display_name="Old Actor")
    other = User.objects.create_user(email="other@example.com", display_name="Other")
    group = create_group(actor=actor, name="Trip", default_currency="EUR")
    _add_user_to_group(other, group)

    # Actor renames themselves after the activity event was recorded.
    actor.display_name = "New Actor"
    actor.save(update_fields=["display_name"])

    response = _auth_client(other).get("/api/activity/")
    created_event = next(
        row for row in response.data["results"] if row["event_type"] == "group.created"
    )
    assert created_event["actor"] == "New Actor"


@pytest.mark.django_db
def test_settlement_activity_includes_live_from_and_to_names():
    User = get_user_model()
    payer = User.objects.create_user(email="payer@example.com", display_name="Payer")
    receiver = User.objects.create_user(email="receiver@example.com", display_name="Receiver")
    group = create_group(actor=payer, name="Trip", default_currency="EUR")
    _add_user_to_group(receiver, group)

    payer_p = get_or_create_user_participant(payer)
    receiver_p = get_or_create_user_participant(receiver)
    create_settlement(
        actor=payer,
        group=group,
        data={
            "amount": "10.00",
            "currency": "EUR",
            "payer_participant_id": payer_p.id,
            "receiver_participant_id": receiver_p.id,
        },
    )

    response = _auth_client(receiver).get("/api/activity/")
    settlement = next(
        row for row in response.data["results"] if row["event_type"] == "settlement.created"
    )
    assert settlement["payload"]["fromName"] == "Payer"
    assert settlement["payload"]["toName"] == "Receiver"
    assert settlement["payload"]["amount"] == "10.00"

    # Rename payer; activity feed reflects the new name on next fetch.
    payer.display_name = "Different Payer"
    payer.save(update_fields=["display_name"])
    response = _auth_client(receiver).get("/api/activity/")
    settlement = next(
        row for row in response.data["results"] if row["event_type"] == "settlement.created"
    )
    assert settlement["payload"]["fromName"] == "Different Payer"


@pytest.mark.django_db
def test_subject_name_falls_back_to_legacy_snapshot():
    """Old events without target_participant_id should still display."""
    User = get_user_model()
    actor = User.objects.create_user(email="actor@example.com", display_name="Actor")
    other = User.objects.create_user(email="other@example.com", display_name="Other")
    group = create_group(actor=actor, name="Trip", default_currency="EUR")
    _add_user_to_group(other, group)

    # Manually create a legacy activity event with snapshot keys (no target_participant_id).
    from splex.activity.models import ActivityEvent

    ActivityEvent.objects.create(
        actor=actor,
        event_type="group.member_added",
        group=group,
        payload={"participantName": "LegacyBob"},
    )

    response = _auth_client(other).get("/api/activity/")
    legacy = next(
        row for row in response.data["results"] if row.get("payload", {}).get("participantName") == "LegacyBob"
    )
    assert legacy["subject_name"] == "LegacyBob"


@pytest.mark.django_db
def test_activity_list_only_returns_events_for_user_contexts():
    User = get_user_model()
    user_a = User.objects.create_user(email="a@example.com", display_name="A")
    user_b = User.objects.create_user(email="b@example.com", display_name="B")
    outsider = User.objects.create_user(email="c@example.com", display_name="C")
    group = create_group(actor=user_a, name="A's group", default_currency="EUR")
    _add_user_to_group(user_b, group)

    response = _auth_client(outsider).get("/api/activity/")
    assert response.status_code == 200
    assert response.data["results"] == []

from django.db import transaction
from django.utils import timezone

from splex.activity.services import record_activity
from splex.expenses.services import context_currency, context_participants, ensure_context_access
from splex.notifications.services import create_notifications_for_activity
from splex.settlements.models import Settlement
from splex.shared.money import money


@transaction.atomic
def create_settlement(*, actor, group=None, friendship=None, data: dict) -> Settlement:
    ensure_context_access(actor, group, friendship)
    currency = context_currency(group, friendship)
    allowed_participant_ids = set(context_participants(group, friendship))
    if data["payer_participant_id"] not in allowed_participant_ids:
        raise ValueError("Payer is not part of this context.")
    if data["receiver_participant_id"] not in allowed_participant_ids:
        raise ValueError("Receiver is not part of this context.")
    if data["payer_participant_id"] == data["receiver_participant_id"]:
        raise ValueError("Payer and receiver must be different.")
    settlement = Settlement.objects.create(
        client_id=data.get("client_id", ""),
        group=group,
        friendship=friendship,
        payer_participant_id=data["payer_participant_id"],
        receiver_participant_id=data["receiver_participant_id"],
        amount=money(data["amount"]),
        currency=currency,
        created_by=actor,
    )
    event = record_activity(
        actor,
        "settlement.created",
        group=group,
        friendship=friendship,
        settlement=settlement,
        payload={"amount": str(settlement.amount), "currency": settlement.currency},
    )
    create_notifications_for_activity(event)
    return settlement


@transaction.atomic
def soft_delete_settlement(*, actor, settlement: Settlement) -> Settlement:
    ensure_context_access(actor, settlement.group, settlement.friendship)
    settlement.deleted_at = timezone.now()
    settlement.save(update_fields=["deleted_at", "updated_at"])
    event = record_activity(
        actor,
        "settlement.deleted",
        group=settlement.group,
        friendship=settlement.friendship,
        settlement=settlement,
        payload={"amount": str(settlement.amount), "currency": settlement.currency},
    )
    create_notifications_for_activity(event)
    return settlement


@transaction.atomic
def update_settlement(*, actor, settlement: Settlement, data: dict) -> Settlement:
    ensure_context_access(actor, settlement.group, settlement.friendship)
    if settlement.deleted_at:
        raise ValueError("Deleted settlements cannot be edited.")
    allowed_participant_ids = set(context_participants(settlement.group, settlement.friendship))
    payer_id = data.get("payer_participant_id", settlement.payer_participant_id)
    receiver_id = data.get("receiver_participant_id", settlement.receiver_participant_id)
    if payer_id not in allowed_participant_ids:
        raise ValueError("Payer is not part of this context.")
    if receiver_id not in allowed_participant_ids:
        raise ValueError("Receiver is not part of this context.")
    if payer_id == receiver_id:
        raise ValueError("Payer and receiver must be different.")

    settlement.payer_participant_id = payer_id
    settlement.receiver_participant_id = receiver_id
    if "amount" in data:
        settlement.amount = money(data["amount"])
    settlement.save(
        update_fields=[
            "payer_participant",
            "receiver_participant",
            "amount",
            "updated_at",
        ]
    )
    event = record_activity(
        actor,
        "settlement.updated",
        group=settlement.group,
        friendship=settlement.friendship,
        settlement=settlement,
        payload={"amount": str(settlement.amount), "currency": settlement.currency},
    )
    create_notifications_for_activity(event)
    return settlement

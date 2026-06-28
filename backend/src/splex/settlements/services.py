from django.db import transaction
from django.utils import timezone

from splex.activity.events import EventType
from splex.activity.services import record_activity
from splex.currency.services import CurrencyRate, convert_for_rate_date
from splex.expenses.services import context_currency, context_participants, ensure_context_access
from splex.notifications.services import create_notifications_for_activity
from splex.settlements.models import Settlement
from splex.shared.errors import DomainError, ErrorCode
from splex.shared.money import money


def _stored_settlement_rate(settlement: Settlement) -> CurrencyRate:
    return CurrencyRate(
        base_currency=settlement.original_currency,
        quote_currency=settlement.currency,
        rate=settlement.exchange_rate,
        source=settlement.exchange_rate_source,
        fetched_at=settlement.updated_at,
        rate_date=settlement.created_at.date(),
    )


@transaction.atomic
def create_settlement(*, actor, group=None, friendship=None, data: dict) -> Settlement:
    ensure_context_access(actor, group, friendship)
    currency = context_currency(group, friendship)
    settlement_currency = (data.get("currency") or currency).upper()
    converted_amount, rate = convert_for_rate_date(
        data["amount"],
        settlement_currency,
        currency,
        timezone.localdate(),
    )
    allowed_participant_ids = set(context_participants(group, friendship))
    if data["payer_participant_id"] not in allowed_participant_ids:
        raise DomainError(
            ErrorCode.SETTLEMENT_PARTICIPANT_INVALID,
            "Payer is not part of this context.",
        )
    if data["receiver_participant_id"] not in allowed_participant_ids:
        raise DomainError(
            ErrorCode.SETTLEMENT_PARTICIPANT_INVALID,
            "Receiver is not part of this context.",
        )
    if data["payer_participant_id"] == data["receiver_participant_id"]:
        raise DomainError(
            ErrorCode.SETTLEMENT_PARTICIPANTS_EQUAL,
            "Payer and receiver must be different.",
        )
    settlement = Settlement.objects.create(
        client_id=data.get("client_id", ""),
        group=group,
        friendship=friendship,
        payer_participant_id=data["payer_participant_id"],
        receiver_participant_id=data["receiver_participant_id"],
        original_amount=money(data["amount"]),
        original_currency=settlement_currency,
        amount=converted_amount,
        currency=currency,
        exchange_rate=rate.rate,
        exchange_rate_source=rate.source,
        created_by=actor,
    )
    event = record_activity(
        actor,
        EventType.SETTLEMENT_CREATED,
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
        EventType.SETTLEMENT_DELETED,
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
        raise DomainError(ErrorCode.SETTLEMENT_DELETED, "Deleted settlements cannot be edited.")
    allowed_participant_ids = set(context_participants(settlement.group, settlement.friendship))
    payer_id = data.get("payer_participant_id", settlement.payer_participant_id)
    receiver_id = data.get("receiver_participant_id", settlement.receiver_participant_id)
    if payer_id not in allowed_participant_ids:
        raise DomainError(
            ErrorCode.SETTLEMENT_PARTICIPANT_INVALID,
            "Payer is not part of this context.",
        )
    if receiver_id not in allowed_participant_ids:
        raise DomainError(
            ErrorCode.SETTLEMENT_PARTICIPANT_INVALID,
            "Receiver is not part of this context.",
        )
    if payer_id == receiver_id:
        raise DomainError(
            ErrorCode.SETTLEMENT_PARTICIPANTS_EQUAL,
            "Payer and receiver must be different.",
        )

    settlement.payer_participant_id = payer_id
    settlement.receiver_participant_id = receiver_id
    context = context_currency(settlement.group, settlement.friendship)
    original_amount = data.get("amount", settlement.original_amount)
    original_currency = str(data.get("currency", settlement.original_currency)).upper()
    amount_changed = "amount" in data
    currency_changed = original_currency != settlement.original_currency
    context_currency_changed = context != settlement.currency
    if amount_changed or currency_changed or context_currency_changed:
        if amount_changed and not currency_changed and not context_currency_changed:
            rate = _stored_settlement_rate(settlement)
            converted_amount = money(money(original_amount) * rate.rate)
        else:
            converted_amount, rate = convert_for_rate_date(
                original_amount,
                original_currency,
                context,
                settlement.created_at.date(),
            )
        settlement.original_amount = money(original_amount)
        settlement.original_currency = original_currency
        settlement.amount = converted_amount
        settlement.currency = context
        settlement.exchange_rate = rate.rate
        settlement.exchange_rate_source = rate.source
    settlement.save(
        update_fields=[
            "payer_participant",
            "receiver_participant",
            "original_amount",
            "original_currency",
            "amount",
            "currency",
            "exchange_rate",
            "exchange_rate_source",
            "updated_at",
        ]
    )
    event = record_activity(
        actor,
        EventType.SETTLEMENT_UPDATED,
        group=settlement.group,
        friendship=settlement.friendship,
        settlement=settlement,
        payload={"amount": str(settlement.amount), "currency": settlement.currency},
    )
    create_notifications_for_activity(event)
    return settlement

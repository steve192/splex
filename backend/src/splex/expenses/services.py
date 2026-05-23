from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from splex.activity.events import EventType
from splex.activity.services import record_activity
from splex.currency.services import convert
from splex.expenses.models import Expense, ExpenseOwedShare, ExpensePaymentShare
from splex.groups.services import assert_group_member
from splex.notifications.services import create_notifications_for_activity
from splex.participants.services import get_or_create_user_participant
from splex.shared.money import assert_sum, money, split_evenly


def context_currency(group=None, friendship=None) -> str:
    if group:
        return group.default_currency
    if friendship:
        return friendship.default_currency
    raise ValueError("Expense requires a group or friendship context.")


def context_participants(group=None, friendship=None):
    if group:
        return list(
            group.memberships.filter(removed_at__isnull=True)
            .select_related("participant")
            .values_list("participant_id", flat=True)
        )
    return [friendship.participant_a_id, friendship.participant_b_id]


def ensure_context_access(actor, group=None, friendship=None):
    actor_participant = get_or_create_user_participant(actor)
    if group:
        assert_group_member(actor, group)
        return actor_participant
    if friendship and actor_participant.id in [
        friendship.participant_a_id,
        friendship.participant_b_id,
    ]:
        return actor_participant
    raise PermissionError("You cannot access this expense context.")


def _normalize_equal_all(total, payload, participant_ids):
    return split_evenly(total, participant_ids)


def _normalize_equal_selected(total, payload, participant_ids):
    selected = payload.get("participant_ids") or payload.get("participantIds") or []
    return split_evenly(total, selected)


def _normalize_exact(total, payload, participant_ids):
    shares = {int(item["participant_id"]): money(item["amount"]) for item in payload["shares"]}
    assert_sum("Exact owed shares", shares.values(), total)
    return shares


def _normalize_percentage(total, payload, participant_ids):
    shares = {}
    percent_sum = Decimal("0")
    for item in payload["shares"]:
        percent = Decimal(str(item["percentage"]))
        percent_sum += percent
        shares[int(item["participant_id"])] = money(total * percent / Decimal("100"))
    if percent_sum != Decimal("100"):
        raise ValueError("Percentages must sum to 100.")
    assert_sum("Percentage owed shares", shares.values(), total)
    return shares


def _normalize_adjusted_equal(total, payload, participant_ids):
    selected = (
        payload.get("participant_ids") or payload.get("participantIds") or participant_ids
    )
    adjustments = {
        int(item["participant_id"]): money(item["amount"])
        for item in payload.get("adjustments", [])
    }
    adjustment_sum = sum(adjustments.values(), Decimal("0"))
    base = split_evenly(money(total) - adjustment_sum, selected)
    adjusted = {
        participant_id: money(amount + adjustments.get(participant_id, 0))
        for participant_id, amount in base.items()
    }
    if any(amount < Decimal("0") for amount in adjusted.values()):
        raise ValueError("Adjustments push someone's owed share below zero.")
    assert_sum("Adjusted owed shares", adjusted.values(), total)
    return adjusted


_SPLIT_NORMALIZERS = {
    Expense.SplitMethod.EQUAL_ALL: _normalize_equal_all,
    Expense.SplitMethod.EQUAL_SELECTED: _normalize_equal_selected,
    Expense.SplitMethod.EXACT: _normalize_exact,
    Expense.SplitMethod.PERCENTAGE: _normalize_percentage,
    Expense.SplitMethod.ADJUSTED_EQUAL: _normalize_adjusted_equal,
}


def normalize_owed_shares(total, method: str, payload: dict, participant_ids):
    normalizer = _SPLIT_NORMALIZERS.get(method)
    if not normalizer:
        raise ValueError(f"Unsupported split method: {method}")
    return normalizer(money(total), payload, participant_ids)


def _parse_payer_shares(payments: list) -> dict:
    return {int(item["participant_id"]): money(item["amount"]) for item in payments}


def _replace_expense_shares(expense, *, payer_shares, owed_shares, currency):
    """Replace an expense's payment & owed share rows with the supplied values."""
    expense.payment_shares.all().delete()
    expense.owed_shares.all().delete()
    ExpensePaymentShare.objects.bulk_create(
        [
            ExpensePaymentShare(
                expense=expense, participant_id=participant_id, amount=amount, currency=currency,
            )
            for participant_id, amount in payer_shares.items()
        ]
    )
    ExpenseOwedShare.objects.bulk_create(
        [
            ExpenseOwedShare(
                expense=expense, participant_id=participant_id, amount=amount, currency=currency,
            )
            for participant_id, amount in owed_shares.items()
        ]
    )


@transaction.atomic
def create_expense(*, actor, group=None, friendship=None, data: dict) -> Expense:
    ensure_context_access(actor, group, friendship)
    # Idempotency: if the client supplied a client_id and we've already created
    # an expense for it, return the existing row instead of creating a duplicate.
    # This protects against the "request succeeded but the response never made
    # it back, client retries" race that would otherwise produce twin expenses.
    client_id = (data.get("client_id") or "").strip()
    if client_id:
        existing = Expense.objects.filter(created_by=actor, client_id=client_id).first()
        if existing is not None:
            return existing
    currency = context_currency(group, friendship)
    converted_amount, rate = convert(data["amount"], data["currency"], currency)
    method = data.get("split_method") or Expense.SplitMethod.EQUAL_ALL
    participants = context_participants(group, friendship)
    payer_shares = _parse_payer_shares(data.get("payments") or [])
    if not payer_shares:
        payer_shares[get_or_create_user_participant(actor).id] = converted_amount
    assert_sum("Payment shares", payer_shares.values(), converted_amount)
    owed_shares = normalize_owed_shares(
        converted_amount,
        method,
        data.get("split_payload") or {},
        participants,
    )
    assert_sum("Owed shares", owed_shares.values(), converted_amount)
    expense = Expense.objects.create(
        client_id=data.get("client_id", ""),
        group=group,
        friendship=friendship,
        description=data["description"],
        date=data.get("date") or timezone.localdate(),
        original_amount=money(data["amount"]),
        original_currency=data["currency"].upper(),
        converted_amount=converted_amount,
        converted_currency=currency,
        exchange_rate=rate.rate,
        exchange_rate_source=rate.source,
        split_method=method,
        split_metadata=data.get("split_payload") or {},
        latitude=data.get("latitude") if actor.location_tracking_enabled else None,
        longitude=data.get("longitude") if actor.location_tracking_enabled else None,
        approximate_location=(
            data.get("approximate_location", "") if actor.location_tracking_enabled else ""
        ),
        created_by=actor,
    )
    _replace_expense_shares(
        expense,
        payer_shares=payer_shares,
        owed_shares=owed_shares,
        currency=currency,
    )
    event = record_activity(
        actor,
        EventType.EXPENSE_CREATED,
        group=group,
        friendship=friendship,
        expense=expense,
        payload={
            "description": expense.description,
            "amount": str(expense.converted_amount),
            "currency": expense.converted_currency,
        },
    )
    create_notifications_for_activity(event)
    return expense


@transaction.atomic
def soft_delete_expense(*, actor, expense: Expense) -> Expense:
    ensure_context_access(actor, expense.group, expense.friendship)
    expense.deleted_at = timezone.now()
    expense.save(update_fields=["deleted_at", "updated_at"])
    event = record_activity(
        actor,
        EventType.EXPENSE_DELETED,
        group=expense.group,
        friendship=expense.friendship,
        expense=expense,
        payload={"description": expense.description},
    )
    create_notifications_for_activity(event)
    return expense

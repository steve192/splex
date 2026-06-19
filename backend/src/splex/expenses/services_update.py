from django.db import transaction

from splex.activity.events import EventType
from splex.activity.services import record_activity
from splex.currency.services import convert
from splex.expenses.models import Expense
from splex.expenses.services import (
    _parse_payer_shares,
    _replace_expense_shares,
    context_currency,
    context_participants,
    ensure_context_access,
    normalize_owed_shares,
)
from splex.groups.models import Group
from splex.notifications.services import create_notifications_for_activity
from splex.shared.money import assert_sum, money

EXPENSE_CONTEXT_GROUP = "group"
EXPENSE_CONTEXT_FRIENDSHIP = "friendship"


def _apply_amount_update(expense: Expense, data: dict, currency: str):
    if (
        "amount" not in data
        and "currency" not in data
        and currency == expense.converted_currency
    ):
        return expense.converted_amount
    original_amount = data.get("amount", expense.original_amount)
    original_currency = data.get("currency", expense.original_currency)
    converted_amount, rate = convert(original_amount, original_currency, currency)
    expense.original_amount = money(original_amount)
    expense.original_currency = str(original_currency).upper()
    expense.converted_amount = converted_amount
    expense.converted_currency = currency
    expense.exchange_rate = rate.rate
    expense.exchange_rate_source = rate.source
    return converted_amount


def _resolve_split_payload(expense: Expense, data: dict, method: str) -> dict:
    if "split_payload" in data:
        return data.get("split_payload") or {}
    if "split_method" in data and method == Expense.SplitMethod.EQUAL_ALL:
        return {}
    return expense.split_metadata


def _resolve_payer_shares(expense: Expense, data: dict) -> dict:
    payments = data.get("payments")
    if payments is not None:
        return _parse_payer_shares(payments)
    return {share.participant_id: share.amount for share in expense.payment_shares.all()}


def _requested_context(data: dict) -> tuple[str | None, int | None]:
    context_type = data.get("context_type")
    context_id = data.get("context_id")
    if context_type is None and context_id is None:
        return None, None
    if context_type != EXPENSE_CONTEXT_GROUP or context_id is None:
        raise ValueError("Only group expenses can be moved to another group.")
    return context_type, context_id


def _resolve_update_context(*, actor, expense: Expense, data: dict):
    context_type, context_id = _requested_context(data)
    if context_type is None:
        return expense.group, expense.friendship
    if expense.friendship_id is not None:
        raise ValueError("Friend expenses cannot be moved.")
    if expense.group_id == context_id:
        return expense.group, None
    group = Group.objects.filter(
        id=context_id,
        deleted_at__isnull=True,
        archived_at__isnull=True,
    ).first()
    if group is None:
        raise ValueError("Target group is not available.")
    ensure_context_access(actor, group, None)
    return group, None


def _assert_context_contains_shares(
    *,
    group,
    friendship,
    payer_shares: dict,
    owed_shares: dict,
):
    participant_ids = set(context_participants(group, friendship))
    share_participant_ids = {*payer_shares.keys(), *owed_shares.keys()}
    if not share_participant_ids.issubset(participant_ids):
        raise ValueError(
            "The target group must include every payer and payee on the expense."
        )


@transaction.atomic
def update_expense(*, actor, expense: Expense, data: dict) -> Expense:
    ensure_context_access(actor, expense.group, expense.friendship)
    group, friendship = _resolve_update_context(actor=actor, expense=expense, data=data)
    currency = context_currency(group, friendship)
    converted_amount = _apply_amount_update(expense, data, currency)
    method = data.get("split_method", expense.split_method)
    split_payload = _resolve_split_payload(expense, data, method)
    payer_shares = _resolve_payer_shares(expense, data)
    assert_sum("Payment shares", payer_shares.values(), converted_amount)
    owed_shares = normalize_owed_shares(
        converted_amount,
        method,
        split_payload,
        context_participants(group, friendship),
    )
    _assert_context_contains_shares(
        group=group,
        friendship=friendship,
        payer_shares=payer_shares,
        owed_shares=owed_shares,
    )
    assert_sum("Owed shares", owed_shares.values(), converted_amount)
    expense.group = group
    expense.friendship = friendship
    expense.description = data.get("description", expense.description)
    expense.date = data.get("date", expense.date)
    expense.split_method = method
    expense.split_metadata = split_payload
    if actor.location_tracking_enabled:
        expense.latitude = data.get("latitude", expense.latitude)
        expense.longitude = data.get("longitude", expense.longitude)
        expense.approximate_location = data.get(
            "approximate_location", expense.approximate_location
        )
    expense.save(
        update_fields=[
            "description",
            "group",
            "friendship",
            "date",
            "original_amount",
            "original_currency",
            "converted_amount",
            "converted_currency",
            "exchange_rate",
            "exchange_rate_source",
            "split_method",
            "split_metadata",
            "latitude",
            "longitude",
            "approximate_location",
            "updated_at",
        ]
    )
    _replace_expense_shares(
        expense,
        payer_shares=payer_shares,
        owed_shares=owed_shares,
        currency=currency,
    )
    expense.receipts.update(group=group, friendship=friendship)
    event = record_activity(
        actor,
        EventType.EXPENSE_UPDATED,
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

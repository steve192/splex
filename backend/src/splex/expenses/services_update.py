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
from splex.notifications.services import create_notifications_for_activity
from splex.shared.money import assert_sum, money


def _apply_amount_update(expense: Expense, data: dict, currency: str):
    if "amount" not in data and "currency" not in data:
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


@transaction.atomic
def update_expense(*, actor, expense: Expense, data: dict) -> Expense:
    ensure_context_access(actor, expense.group, expense.friendship)
    currency = context_currency(expense.group, expense.friendship)
    converted_amount = _apply_amount_update(expense, data, currency)
    method = data.get("split_method", expense.split_method)
    split_payload = _resolve_split_payload(expense, data, method)
    payer_shares = _resolve_payer_shares(expense, data)
    assert_sum("Payment shares", payer_shares.values(), converted_amount)
    owed_shares = normalize_owed_shares(
        converted_amount,
        method,
        split_payload,
        context_participants(expense.group, expense.friendship),
    )
    assert_sum("Owed shares", owed_shares.values(), converted_amount)
    expense.description = data.get("description", expense.description)
    expense.date = data.get("date", expense.date)
    expense.split_method = method
    expense.split_metadata = split_payload
    expense.save(
        update_fields=[
            "description",
            "date",
            "original_amount",
            "original_currency",
            "converted_amount",
            "converted_currency",
            "exchange_rate",
            "exchange_rate_source",
            "split_method",
            "split_metadata",
            "updated_at",
        ]
    )
    _replace_expense_shares(
        expense,
        payer_shares=payer_shares,
        owed_shares=owed_shares,
        currency=currency,
    )
    event = record_activity(
        actor,
        EventType.EXPENSE_UPDATED,
        group=expense.group,
        friendship=expense.friendship,
        expense=expense,
        payload={"description": expense.description},
    )
    create_notifications_for_activity(event)
    return expense

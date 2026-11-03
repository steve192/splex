from django.db import transaction

from splex.activity.events import EventType
from splex.activity.services import record_activity
from splex.currency.constants import ExchangeRateSource
from splex.expenses.conversion import (
    ExpenseConversion,
    is_amount_paid_applicable,
    resolve_expense_conversion,
)
from splex.expenses.models import Expense
from splex.expenses.services import (
    _parse_payer_shares,
    _replace_expense_shares,
    context_currency,
    context_participants,
    ensure_context_access,
    normalize_owed_shares,
    scale_shares_to_total,
)
from splex.groups.models import Group
from splex.notifications.services import create_notifications_for_activity
from splex.shared.errors import DomainError, ErrorCode
from splex.shared.money import assert_sum, money

EXPENSE_CONTEXT_GROUP = "group"
EXPENSE_CONTEXT_FRIENDSHIP = "friendship"


def _resolve_conversion(
    expense: Expense,
    data: dict,
    *,
    amount,
    currency: str,
    context_currency: str,
    rate_date,
    payer_count: int,
) -> ExpenseConversion:
    if "converted_amount" in data:
        amount_paid = data["converted_amount"]
    elif _keeps_amount_paid(expense, currency, context_currency, payer_count):
        amount_paid = expense.converted_amount
    else:
        amount_paid = None
    if amount_paid is None and _keeps_official_rate(expense, currency, context_currency, rate_date):
        return ExpenseConversion(
            converted_amount=(
                expense.converted_amount
                if amount == expense.original_amount
                else money(amount * expense.exchange_rate)
            ),
            exchange_rate=expense.exchange_rate,
            exchange_rate_source=expense.exchange_rate_source,
            exchange_rate_date=expense.exchange_rate_date,
        )
    return resolve_expense_conversion(
        amount=amount,
        currency=currency,
        context_currency=context_currency,
        rate_date=rate_date,
        amount_paid=amount_paid,
        payer_count=payer_count,
    )


def _keeps_amount_paid(
    expense: Expense, currency: str, context_currency: str, payer_count: int
) -> bool:
    return (
        expense.exchange_rate_source == ExchangeRateSource.MANUAL
        and context_currency == expense.converted_currency
        and is_amount_paid_applicable(
            currency=currency, context_currency=context_currency, payer_count=payer_count
        )
    )


def _keeps_official_rate(expense: Expense, currency: str, context_currency: str, rate_date) -> bool:
    # A changed date or currency pair needs the official rate for the new values.
    return (
        expense.exchange_rate_source != ExchangeRateSource.MANUAL
        and currency == expense.original_currency
        and context_currency == expense.converted_currency
        and rate_date == expense.date
    )


def _resolve_split_payload(expense: Expense, data: dict, method: str) -> dict:
    if "split_payload" in data:
        return data.get("split_payload") or {}
    if "split_method" in data and method == Expense.SplitMethod.EQUAL_ALL:
        return {}
    return expense.split_metadata


def _requested_payer_shares(expense: Expense, data: dict, original_amount) -> dict:
    payments = data.get("payments")
    if payments is None:
        # Stored rows are in the context currency; only their proportions are reused.
        return {share.participant_id: share.amount for share in expense.payment_shares.all()}
    shares = _parse_payer_shares(payments)
    assert_sum("Payment shares", shares.values(), original_amount)
    return shares


def _requested_context(data: dict) -> tuple[str | None, int | None]:
    context_type = data.get("context_type")
    context_id = data.get("context_id")
    if context_type is None and context_id is None:
        return None, None
    if context_type != EXPENSE_CONTEXT_GROUP or context_id is None:
        raise DomainError(
            ErrorCode.EXPENSE_MOVE_GROUP_ONLY,
            "Only group expenses can be moved to another group.",
        )
    return context_type, context_id


def _resolve_update_context(*, actor, expense: Expense, data: dict):
    context_type, context_id = _requested_context(data)
    if context_type is None:
        return expense.group, expense.friendship
    if expense.friendship_id is not None:
        raise DomainError(
            ErrorCode.EXPENSE_FRIEND_MOVE_FORBIDDEN,
            "Friend expenses cannot be moved.",
        )
    if expense.group_id == context_id:
        return expense.group, None
    group = Group.objects.filter(
        id=context_id,
        deleted_at__isnull=True,
        archived_at__isnull=True,
    ).first()
    if group is None:
        raise DomainError(
            ErrorCode.EXPENSE_TARGET_GROUP_INVALID,
            "Target group is not available.",
        )
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
        raise DomainError(
            ErrorCode.EXPENSE_TARGET_PARTICIPANTS_MISSING,
            "The target group must include every payer and payee.",
        )


@transaction.atomic
def update_expense(*, actor, expense: Expense, data: dict) -> Expense:
    ensure_context_access(actor, expense.group, expense.friendship)
    group, friendship = _resolve_update_context(actor=actor, expense=expense, data=data)
    currency = context_currency(group, friendship)
    original_amount = money(data.get("amount", expense.original_amount))
    original_currency = str(data.get("currency", expense.original_currency)).upper()
    expense_date = data.get("date", expense.date)
    method = data.get("split_method", expense.split_method)
    split_payload = _resolve_split_payload(expense, data, method)
    payer_shares = _requested_payer_shares(expense, data, original_amount)
    owed_shares = normalize_owed_shares(
        original_amount,
        method,
        split_payload,
        context_participants(group, friendship),
    )
    assert_sum("Owed shares", owed_shares.values(), original_amount)
    conversion = _resolve_conversion(
        expense,
        data,
        amount=original_amount,
        currency=original_currency,
        context_currency=currency,
        rate_date=expense_date,
        payer_count=len(payer_shares),
    )
    payer_shares = scale_shares_to_total(payer_shares, conversion.converted_amount)
    owed_shares = scale_shares_to_total(owed_shares, conversion.converted_amount)
    _assert_context_contains_shares(
        group=group,
        friendship=friendship,
        payer_shares=payer_shares,
        owed_shares=owed_shares,
    )
    assert_sum("Owed shares", owed_shares.values(), conversion.converted_amount)
    expense.group = group
    expense.friendship = friendship
    expense.description = data.get("description", expense.description)
    expense.date = expense_date
    expense.original_amount = original_amount
    expense.original_currency = original_currency
    expense.converted_currency = currency
    for field, value in conversion.model_fields().items():
        setattr(expense, field, value)
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
            "exchange_rate_date",
            "official_exchange_rate",
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

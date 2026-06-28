from django.db import transaction

from splex.activity.events import EventType
from splex.activity.services import record_activity
from splex.currency.services import CurrencyRate, convert_for_rate_date
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


def _stored_expense_rate(expense: Expense) -> CurrencyRate:
    # Reuse this only when the expense amount changes but the expense date and
    # currencies do not. A date edit means the historical rate should be looked
    # up again for the new expense date.
    return CurrencyRate(
        base_currency=expense.original_currency,
        quote_currency=expense.converted_currency,
        rate=expense.exchange_rate,
        source=expense.exchange_rate_source,
        fetched_at=expense.updated_at,
        rate_date=expense.exchange_rate_date,
    )


def _apply_amount_update(expense: Expense, data: dict, currency: str):
    # requested_rate_date is the user-facing expense date after the edit.
    # expense.exchange_rate_date is the date of the rate currently stored.
    requested_rate_date = data.get("date", expense.date)
    date_changed = requested_rate_date != expense.date
    if (
        "amount" not in data
        and "currency" not in data
        and currency == expense.converted_currency
        and not date_changed
    ):
        return expense.converted_amount
    original_amount = data.get("amount", expense.original_amount)
    original_currency = str(data.get("currency", expense.original_currency)).upper()
    amount_changed = "amount" in data
    currency_changed = original_currency != expense.original_currency
    context_currency_changed = currency != expense.converted_currency
    if (
        not amount_changed
        and not currency_changed
        and not context_currency_changed
        and not date_changed
    ):
        return expense.converted_amount
    if (
        amount_changed
        and not currency_changed
        and not context_currency_changed
        and not date_changed
    ):
        rate = _stored_expense_rate(expense)
        converted_amount = money(money(original_amount) * rate.rate)
    else:
        # Currency/context changes and date changes must resolve a rate for the
        # requested expense date. The returned rate date may differ on fallback.
        converted_amount, rate = convert_for_rate_date(
            original_amount,
            original_currency,
            currency,
            requested_rate_date,
        )
    expense.original_amount = money(original_amount)
    expense.original_currency = original_currency
    expense.converted_amount = converted_amount
    expense.converted_currency = currency
    expense.exchange_rate = rate.rate
    expense.exchange_rate_source = rate.source
    expense.exchange_rate_date = rate.rate_date
    return converted_amount


def _resolve_split_payload(expense: Expense, data: dict, method: str) -> dict:
    if "split_payload" in data:
        return data.get("split_payload") or {}
    if "split_method" in data and method == Expense.SplitMethod.EQUAL_ALL:
        return {}
    return expense.split_metadata


def _resolve_payer_shares(expense: Expense, data: dict, converted_amount) -> dict:
    payments = data.get("payments")
    if payments is not None:
        # Incoming payment rows are in the expense's original currency. Stored
        # payment rows are in the context currency used by balances.
        shares = _parse_payer_shares(payments)
        original_amount = money(data.get("amount", expense.original_amount))
        assert_sum("Payment shares", shares.values(), original_amount)
        return scale_shares_to_total(shares, converted_amount)
    shares = {share.participant_id: share.amount for share in expense.payment_shares.all()}
    return scale_shares_to_total(shares, converted_amount)


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
    converted_amount = _apply_amount_update(expense, data, currency)
    method = data.get("split_method", expense.split_method)
    split_payload = _resolve_split_payload(expense, data, method)
    original_amount = money(data.get("amount", expense.original_amount))
    payer_shares = _resolve_payer_shares(expense, data, converted_amount)
    owed_shares = normalize_owed_shares(
        original_amount,
        method,
        split_payload,
        context_participants(group, friendship),
    )
    assert_sum("Owed shares", owed_shares.values(), original_amount)
    owed_shares = scale_shares_to_total(owed_shares, converted_amount)
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
            "exchange_rate_date",
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

from django.db import transaction

from splex.activity.services import record_activity
from splex.currency.services import convert
from splex.expenses.models import Expense, ExpenseOwedShare, ExpensePaymentShare
from splex.expenses.services import (
    context_currency,
    ensure_context_access,
    normalize_owed_shares,
)
from splex.notifications.services import create_notifications_for_activity
from splex.shared.money import assert_sum, money


@transaction.atomic
def update_expense(*, actor, expense: Expense, data: dict) -> Expense:
    ensure_context_access(actor, expense.group, expense.friendship)
    currency = context_currency(expense.group, expense.friendship)
    if "amount" in data or "currency" in data:
        original_amount = data.get("amount", expense.original_amount)
        original_currency = data.get("currency", expense.original_currency)
        converted_amount, rate = convert(original_amount, original_currency, currency)
        expense.original_amount = money(original_amount)
        expense.original_currency = str(original_currency).upper()
        expense.converted_amount = converted_amount
        expense.converted_currency = currency
        expense.exchange_rate = rate.rate
        expense.exchange_rate_source = rate.source
    else:
        converted_amount = expense.converted_amount
    method = data.get("split_method", expense.split_method)
    if "split_payload" in data:
        split_payload = data.get("split_payload") or {}
    elif "split_method" in data and method == Expense.SplitMethod.EQUAL_ALL:
        split_payload = {}
    else:
        split_payload = expense.split_metadata
    participant_ids = list(
        expense.group.memberships.filter(removed_at__isnull=True).values_list(
            "participant_id", flat=True
        )
        if expense.group
        else [expense.friendship.participant_a_id, expense.friendship.participant_b_id]
    )
    payments = data.get("payments")
    if payments is not None:
        payer_shares = {int(item["participant_id"]): money(item["amount"]) for item in payments}
    else:
        payer_shares = {
            share.participant_id: share.amount for share in expense.payment_shares.all()
        }
    assert_sum("Payment shares", payer_shares.values(), converted_amount)
    owed_shares = normalize_owed_shares(
        converted_amount,
        method,
        split_payload,
        participant_ids,
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
    expense.payment_shares.all().delete()
    expense.owed_shares.all().delete()
    ExpensePaymentShare.objects.bulk_create(
        [
            ExpensePaymentShare(
                expense=expense, participant_id=pid, amount=amount, currency=currency
            )
            for pid, amount in payer_shares.items()
        ]
    )
    ExpenseOwedShare.objects.bulk_create(
        [
            ExpenseOwedShare(expense=expense, participant_id=pid, amount=amount, currency=currency)
            for pid, amount in owed_shares.items()
        ]
    )
    event = record_activity(
        actor,
        "expense.updated",
        group=expense.group,
        friendship=expense.friendship,
        expense=expense,
        payload={"description": expense.description},
    )
    create_notifications_for_activity(event)
    return expense

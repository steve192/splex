from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from datetime import date as date_cls
from decimal import Decimal

from django.db.models import Count, Max, Min, Sum
from django.db.models.functions import TruncMonth

from splex.expenses.models import Expense, ExpenseOwedShare, ExpensePaymentShare
from splex.friends.models import Friendship
from splex.groups.models import Group
from splex.participants.models import Participant

ZERO = Decimal("0")
TOP_DESCRIPTION_LIMIT = 8
BIGGEST_EXPENSES_LIMIT = 5
LOCATION_LIMIT = 100
PAIR_STATS_LIMIT = 10
MONTHLY_HISTORY_MONTHS = 12


def _money(value: Decimal | None) -> str:
    return str((value or ZERO).quantize(Decimal("0.01")))


def group_statistics(group: Group) -> dict:
    """Aggregated statistics for all non-deleted expenses in a group."""
    expenses = Expense.objects.filter(group=group, deleted_at__isnull=True)
    participants = _group_participants(group)
    return _compute(expenses, participants, group.default_currency)


def friendship_statistics(friendship: Friendship) -> dict:
    """Aggregated statistics for all non-deleted expenses on a friendship."""
    expenses = Expense.objects.filter(friendship=friendship, deleted_at__isnull=True)
    participants = [friendship.participant_a, friendship.participant_b]
    return _compute(expenses, participants, friendship.default_currency)


def _group_participants(group: Group) -> list[Participant]:
    from splex.groups.models import GroupMembership

    memberships = (
        GroupMembership.objects.filter(group=group, removed_at__isnull=True)
        .select_related("participant", "participant__user")
    )
    return [m.participant for m in memberships]


def _compute(expenses_qs, participants: Iterable[Participant], currency: str) -> dict:
    """Build the full statistics payload. Monetary aggregates use `currency`,
    which matches `Expense.converted_amount` for the queryset's context."""
    summary = _summary(expenses_qs, currency)
    monthly = _monthly_series(expenses_qs)
    contributions = _contributions(expenses_qs, list(participants))
    top_descriptions = _top_descriptions(expenses_qs)
    biggest_expenses = _biggest_expenses(expenses_qs)
    locations = _locations(expenses_qs)
    day_of_week = _day_of_week(expenses_qs)
    pair_stats = _pair_stats(expenses_qs)

    return {
        "summary": summary,
        "monthly": monthly,
        "contributions": contributions,
        "top_descriptions": top_descriptions,
        "biggest_expenses": biggest_expenses,
        "locations": locations,
        "day_of_week": day_of_week,
        "pair_stats": pair_stats,
    }


def _summary(expenses, currency: str) -> dict:
    agg = expenses.aggregate(
        total=Sum("converted_amount"),
        count=Count("id"),
        first_date=Min("date"),
        last_date=Max("date"),
    )
    total = agg["total"] or ZERO
    count = agg["count"] or 0
    avg = (total / count) if count else ZERO
    first_date = agg["first_date"]
    last_date = agg["last_date"]

    spend_per_week = ZERO
    if count and first_date and last_date and total > 0:
        span_days = max((last_date - first_date).days, 0) + 1
        weeks = Decimal(span_days) / Decimal(7)
        if weeks > 0:
            spend_per_week = (total / weeks).quantize(Decimal("0.01"))

    by_currency = (
        expenses.values("original_currency")
        .annotate(total=Sum("original_amount"), count=Count("id"))
        .order_by("-total")
    )
    currency_breakdown = [
        {
            "currency": row["original_currency"],
            "total": _money(row["total"]),
            "count": row["count"],
        }
        for row in by_currency
    ]

    return {
        "currency": currency,
        "total_amount": _money(total),
        "expense_count": count,
        "average_amount": _money(avg),
        "first_expense_date": first_date.isoformat() if first_date else None,
        "last_expense_date": last_date.isoformat() if last_date else None,
        "spend_per_week": _money(spend_per_week),
        "currency_breakdown": currency_breakdown,
    }


def _monthly_series(expenses) -> list[dict]:
    rows = (
        expenses.annotate(month=TruncMonth("date"))
        .values("month")
        .annotate(total=Sum("converted_amount"))
        .order_by("month")
    )
    by_month: dict[date_cls, Decimal] = {row["month"]: row["total"] or ZERO for row in rows}

    today = date_cls.today().replace(day=1)
    series: list[dict] = []
    cursor = today
    for _ in range(MONTHLY_HISTORY_MONTHS):
        amount = by_month.get(cursor, ZERO)
        series.append({"month": cursor.isoformat(), "total": _money(amount)})
        if cursor.month == 1:
            cursor = cursor.replace(year=cursor.year - 1, month=12)
        else:
            cursor = cursor.replace(month=cursor.month - 1)
    series.reverse()
    return series


def _contributions(expenses_qs, participants: list[Participant]) -> list[dict]:
    if not participants:
        return []
    participant_ids = [p.id for p in participants]

    paid_rows = (
        ExpensePaymentShare.objects.filter(
            expense__in=expenses_qs,
            participant_id__in=participant_ids,
        )
        .values("participant_id")
        .annotate(total=Sum("amount"))
    )
    share_rows = (
        ExpenseOwedShare.objects.filter(
            expense__in=expenses_qs,
            participant_id__in=participant_ids,
        )
        .values("participant_id")
        .annotate(total=Sum("amount"))
    )

    paid_by = {row["participant_id"]: row["total"] or ZERO for row in paid_rows}
    share_by = {row["participant_id"]: row["total"] or ZERO for row in share_rows}

    rows = []
    for participant in participants:
        rows.append(
            {
                "participant_id": participant.id,
                "display_name": participant.effective_display_name,
                "paid": _money(paid_by.get(participant.id, ZERO)),
                "share": _money(share_by.get(participant.id, ZERO)),
            }
        )
    rows.sort(key=lambda r: Decimal(r["paid"]), reverse=True)
    return rows


def _top_descriptions(expenses) -> list[dict]:
    buckets: dict[str, dict] = defaultdict(lambda: {"display": "", "count": 0, "total": ZERO})
    for description, amount in expenses.values_list("description", "converted_amount"):
        key = (description or "").strip().lower()
        if not key:
            continue
        bucket = buckets[key]
        if not bucket["display"]:
            bucket["display"] = description.strip()
        bucket["count"] += 1
        bucket["total"] += amount or ZERO

    ranked = sorted(
        buckets.values(),
        key=lambda b: (b["count"], b["total"]),
        reverse=True,
    )[:TOP_DESCRIPTION_LIMIT]
    return [
        {
            "description": b["display"],
            "count": b["count"],
            "total": _money(b["total"]),
        }
        for b in ranked
    ]


def _biggest_expenses(expenses) -> list[dict]:
    rows = expenses.order_by("-converted_amount")[:BIGGEST_EXPENSES_LIMIT]
    return [
        {
            "id": e.id,
            "description": e.description,
            "amount": _money(e.original_amount),
            "currency": e.original_currency,
            "converted_amount": _money(e.converted_amount),
            "converted_currency": e.converted_currency,
            "date": e.date.isoformat(),
        }
        for e in rows
    ]


def _locations(expenses) -> list[dict]:
    rows = (
        expenses.exclude(latitude__isnull=True)
        .exclude(longitude__isnull=True)
        .order_by("-date")[:LOCATION_LIMIT]
    )
    return [
        {
            "id": e.id,
            "description": e.description,
            "latitude": float(e.latitude),
            "longitude": float(e.longitude),
            "amount": _money(e.original_amount),
            "currency": e.original_currency,
            "date": e.date.isoformat(),
        }
        for e in rows
    ]


def _day_of_week(expenses) -> list[dict]:
    """Spending broken down by ISO weekday (Mon=0, Sun=6)."""
    totals = [ZERO] * 7
    counts = [0] * 7
    for expense_date, amount in expenses.values_list("date", "converted_amount"):
        if expense_date is None:
            continue
        idx = expense_date.weekday()
        totals[idx] += amount or ZERO
        counts[idx] += 1
    return [
        {"weekday": i, "count": counts[i], "total": _money(totals[i])}
        for i in range(7)
    ]


def _pair_stats(expenses_qs) -> list[dict]:
    """For each (payer, beneficiary) pair, count expenses where the payer
    contributed *and* the beneficiary owed a share, attributing the
    beneficiary's owed amount as the payer's "coverage" for the beneficiary.

    Multi-payer expenses are handled fairly: the beneficiary's owed amount
    is split across the payers in proportion to how much each payer paid.

    Self-pairs (payer == beneficiary) are skipped.
    """
    expense_ids = list(expenses_qs.values_list("id", flat=True))
    if not expense_ids:
        return []

    payments_by_expense = _shares_by_expense(ExpensePaymentShare, expense_ids)
    owed_by_expense = _shares_by_expense(ExpenseOwedShare, expense_ids)

    pair_totals: dict[tuple[int, int], dict] = defaultdict(lambda: {"count": 0, "amount": ZERO})
    for expense_id in expense_ids:
        _accumulate_pairs(
            payments_by_expense.get(expense_id, []),
            owed_by_expense.get(expense_id, []),
            pair_totals,
        )

    if not pair_totals:
        return []

    name_by_id = _resolve_participant_names({pid for pair in pair_totals for pid in pair})
    ranked = sorted(
        pair_totals.items(),
        key=lambda item: (item[1]["amount"], item[1]["count"]),
        reverse=True,
    )[:PAIR_STATS_LIMIT]
    return [
        {
            "payer_id": payer_id,
            "payer_name": name_by_id.get(payer_id, ""),
            "beneficiary_id": beneficiary_id,
            "beneficiary_name": name_by_id.get(beneficiary_id, ""),
            "count": data["count"],
            "amount": _money(data["amount"]),
        }
        for (payer_id, beneficiary_id), data in ranked
    ]


def _shares_by_expense(model, expense_ids: list[int]) -> dict[int, list[tuple[int, Decimal]]]:
    grouped: dict[int, list[tuple[int, Decimal]]] = defaultdict(list)
    rows = model.objects.filter(expense_id__in=expense_ids).values_list(
        "expense_id", "participant_id", "amount"
    )
    for expense_id, participant_id, amount in rows:
        grouped[expense_id].append((participant_id, amount or ZERO))
    return grouped


def _accumulate_pairs(
    payments: list[tuple[int, Decimal]],
    owed: list[tuple[int, Decimal]],
    pair_totals: dict[tuple[int, int], dict],
) -> None:
    total_paid = sum((amount for _, amount in payments), ZERO)
    if total_paid <= 0:
        return
    for payer_id, payer_amount in payments:
        payer_weight = payer_amount / total_paid
        for beneficiary_id, beneficiary_amount in owed:
            if beneficiary_id == payer_id:
                continue
            entry = pair_totals[(payer_id, beneficiary_id)]
            entry["count"] += 1
            entry["amount"] += beneficiary_amount * payer_weight


def _resolve_participant_names(participant_ids: set[int]) -> dict[int, str]:
    name_by_id: dict[int, str] = {}
    for participant in Participant.objects.filter(id__in=participant_ids).select_related("user"):
        name_by_id[participant.id] = participant.effective_display_name
    return name_by_id


__all__ = ["group_statistics", "friendship_statistics"]

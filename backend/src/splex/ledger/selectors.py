from __future__ import annotations

from splex.expenses.models import Expense
from splex.ledger.serializers import serialize_ledger_item
from splex.settlements.models import Settlement

DEFAULT_LEDGER_LIMIT = 50
MAX_LEDGER_LIMIT = 100


def _ledger_items(*, group=None, friendship=None):
    expense_filter = {"deleted_at__isnull": True}
    settlement_filter = {"deleted_at__isnull": True}
    if group is not None:
        expense_filter["group"] = group
        settlement_filter["group"] = group
    if friendship is not None:
        expense_filter["friendship"] = friendship
        settlement_filter["friendship"] = friendship

    expenses = list(
        Expense.objects.filter(**expense_filter).prefetch_related(
            "payment_shares", "owed_shares"
        )
    )
    settlements = list(
        Settlement.objects.filter(**settlement_filter).select_related(
            "payer_participant__user", "receiver_participant__user"
        )
    )
    return sorted(
        [*expenses, *settlements],
        key=lambda item: item.created_at,
        reverse=True,
    )


def paginated_ledger_response(
    *, group=None, friendship=None, limit=None, offset=None
) -> dict | list:
    items = _ledger_items(group=group, friendship=friendship)
    if limit is None and offset is None:
        return [serialize_ledger_item(item) for item in items]
    resolved_limit = min(int(limit or DEFAULT_LEDGER_LIMIT), MAX_LEDGER_LIMIT)
    resolved_offset = max(int(offset or 0), 0)
    page = items[resolved_offset : resolved_offset + resolved_limit]
    return {
        "results": [serialize_ledger_item(item) for item in page],
        "next_offset": (
            resolved_offset + resolved_limit if len(page) == resolved_limit else None
        ),
    }

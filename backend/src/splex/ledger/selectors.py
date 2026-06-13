from __future__ import annotations

from splex.expenses.models import Expense
from splex.ledger.serializers import serialize_ledger_item
from splex.participants.models import Participant
from splex.settlements.models import Settlement

DEFAULT_LEDGER_LIMIT = 50
MAX_LEDGER_LIMIT = 100


def _participant_name_map(expenses):
    """Resolve participant display names for the payers/payees of the given
    expenses in a single query so search can match against them."""
    participant_ids = set()
    for expense in expenses:
        for share in expense.payment_shares.all():
            participant_ids.add(share.participant_id)
        for share in expense.owed_shares.all():
            participant_ids.add(share.participant_id)
    participants = Participant.objects.filter(id__in=participant_ids).select_related("user")
    return {participant.id: participant.effective_display_name for participant in participants}


def _matches_search(item, term, participant_names):
    if isinstance(item, Expense):
        parts = [item.description or "", str(item.original_amount), str(item.converted_amount)]
        for share in item.payment_shares.all():
            parts.append(participant_names.get(share.participant_id, ""))
        for share in item.owed_shares.all():
            parts.append(participant_names.get(share.participant_id, ""))
    else:
        parts = [
            item.payer_participant.effective_display_name,
            item.receiver_participant.effective_display_name,
            str(item.amount),
        ]
    return term in " ".join(parts).lower()


def _ledger_items(*, group=None, friendship=None, search=None):
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
    # Order by the user-meaningful date (expense.date / settlement creation day),
    # then by created_at for a stable tiebreaker within the same day. Settlements
    # have no explicit date field, so fall back to the date portion of created_at.
    def _ledger_key(item):
        item_date = getattr(item, "date", None) or item.created_at.date()
        return (item_date, item.created_at)

    items = sorted([*expenses, *settlements], key=_ledger_key, reverse=True)

    term = (search or "").strip().lower()
    if term:
        participant_names = _participant_name_map(expenses)
        items = [item for item in items if _matches_search(item, term, participant_names)]
    return items


def paginated_ledger_response(
    *, group=None, friendship=None, limit=None, offset=None, search=None
) -> dict | list:
    items = _ledger_items(group=group, friendship=friendship, search=search)
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

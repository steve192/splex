"""Mirror a Split Pro PostgreSQL database into Splex.

Split Pro stores ``Expense.amount`` and ``ExpenseParticipant.amount`` as
``BigInt`` values in the smallest unit of the expense currency.  Each
``ExpenseParticipant.amount`` is a *net* position: ``paid_share - owed_share``.
The payer's share has the full ``Expense.amount`` baked in, every non-payer
has a negative net.  All participants of one expense sum to zero.

We rebuild Splex payment and owed shares from those nets, convert to the
group's currency, and absorb rounding drift into the largest owed share so
totals match exactly - same approach as the Splitwise import.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from splex.currency.services import convert_for_rate_date
from splex.expenses.models import Expense, ExpenseOwedShare, ExpensePaymentShare
from splex.groups.models import Group
from splex.groups.services import add_unregistered_participant, create_group
from splex.imports.split_pro_client import (
    SplitProClient,
    SplitProConnection,
    SplitProError,
)
from splex.imports.summary import ImportSummary
from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant
from splex.settlements.models import Settlement
from splex.shared.money import money

# Currencies whose smallest unit is *not* 1/100 of the major unit.  Split Pro
# embeds this table; we mirror the non-2-decimal entries here so the BigInt
# amounts decode correctly.  Anything else falls back to 2 decimal places.
_CURRENCY_DECIMALS_ZERO = {
    "AFN", "ALL", "AMD", "BIF", "CLP", "COP", "CRC", "DJF", "GNF", "HUF",
    "IDR", "IQD", "IRR", "ISK", "JPY", "KMF", "KRW", "LBP", "MGA", "MMK",
    "MUR", "PKR", "PYG", "RSD", "RWF", "SOS", "SYP", "TZS", "UGX", "UZS",
    "VND", "XAF", "XOF", "YER", "ZMK", "ZWL",
}
_CURRENCY_DECIMALS_THREE = {"BHD", "JOD", "KWD", "LYD", "OMR", "TND"}

# Split-pro split types we mirror specially.  Everything else (EQUAL,
# PERCENTAGE, EXACT, SHARE, ADJUSTMENT) ends up as a regular Splex EXACT split
# because per-participant amounts are already concrete in Split Pro.
_SETTLEMENT_SPLIT_TYPE = "SETTLEMENT"
_CURRENCY_CONVERSION_SPLIT_TYPE = "CURRENCY_CONVERSION"


class SplitProUserNotFoundError(SplitProError):
    """Raised when the selected Split Pro user id does not exist."""


def list_split_pro_users(connection: SplitProConnection,
                         *, client: SplitProClient | None = None) -> list[dict]:
    """Connect to Split Pro and return ``[{id, name, email}, ...]``.

    Used by the import UI to populate the "which user are you?" picker.
    The Splex user's email is *not* used to pre-select - that proved
    unreliable for Split Pro accounts that don't have an email set, or
    where the user's Splex email differs from their Split Pro email.
    """
    if client is None:
        with SplitProClient(connection) as managed:
            return _coerce_user_list(managed.list_users())
    return _coerce_user_list(client.list_users())


def _coerce_user_list(rows: list[dict]) -> list[dict]:
    return [
        {
            "id": int(row["id"]),
            "name": row.get("name") or "",
            "email": row.get("email") or "",
        }
        for row in rows
    ]


def import_from_split_pro(*, actor, connection: SplitProConnection,
                          actor_user_id: int,
                          import_friends_as_groups: bool = False,
                          client: SplitProClient | None = None
                          ) -> ImportSummary:
    """Pull the data of Split Pro user ``actor_user_id`` into Splex.

    ``connection`` is consumed for this single request only; nothing is
    persisted.  The whole import runs in a single Splex DB transaction so a
    failure halfway through does not leave a partially-populated account.

    ``actor_user_id`` is the Split Pro user the caller selected as
    themselves.  We require an explicit choice (rather than guessing by
    email) because Split Pro users may not have an email set, and a Splex
    user's email may not match their Split Pro one.

    ``import_friends_as_groups`` mirrors the Splitwise import: when enabled,
    each Split Pro non-group expense between you and one other user is
    imported into a dedicated two-person Splex group.
    """
    if client is None:
        with SplitProClient(connection) as managed:
            return _run_import(
                actor=actor, client=managed, actor_user_id=actor_user_id,
                import_friends_as_groups=import_friends_as_groups,
            )
    return _run_import(
        actor=actor, client=client, actor_user_id=actor_user_id,
        import_friends_as_groups=import_friends_as_groups,
    )


def _run_import(*, actor, client: SplitProClient, actor_user_id: int,
                import_friends_as_groups: bool) -> ImportSummary:
    actor_user = client.get_user(actor_user_id)
    if actor_user is None:
        raise SplitProUserNotFoundError(
            f"Split Pro user with id {actor_user_id} does not exist in the "
            "connected database."
        )
    actor_sp_id = int(actor_user["id"])
    summary = ImportSummary()
    fallback_currency = (actor.default_currency or "EUR").upper()

    with transaction.atomic():
        sp_groups = client.get_groups_for_user(actor_sp_id)
        for sp_group in sp_groups:
            _import_group(
                client=client, actor=actor, sp_group=sp_group,
                actor_sp_id=actor_sp_id,
                fallback_currency=fallback_currency,
                summary=summary,
            )

        if import_friends_as_groups:
            _import_friend_groups(
                client=client, actor=actor, actor_sp_id=actor_sp_id,
                fallback_currency=fallback_currency, summary=summary,
            )

    return summary


# ---------------------------------------------------------------------------
# group import
# ---------------------------------------------------------------------------


def _import_group(*, client: SplitProClient, actor, sp_group: dict,
                  actor_sp_id: int, fallback_currency: str,
                  summary: ImportSummary) -> None:
    sp_group_id = sp_group.get("id")
    if sp_group_id is None:
        summary.skipped_expenses += 1
        return

    expenses = client.get_group_expenses(sp_group_id) or []
    participants_by_expense = client.get_participants_for_expenses(
        [expense["id"] for expense in expenses]
    )

    group_default = (sp_group.get("defaultCurrency") or "").upper().strip()
    currency = group_default or _pick_currency_from_expenses(
        expenses, fallback_currency,
    )

    group = create_group(
        actor=actor,
        name=(sp_group.get("name") or "Split Pro group")[:180],
        default_currency=currency,
    )
    summary.groups_created += 1

    member_ids = set(client.get_group_members(sp_group_id))
    # Also include anyone who shows up in an expense - members may have left
    # the group but their historical expenses still reference them.
    for participants in participants_by_expense.values():
        for participant in participants:
            member_ids.add(participant["userId"])

    sp_to_participant = _build_participant_map(
        client=client, actor=actor, group=group, actor_sp_id=actor_sp_id,
        sp_user_ids=member_ids,
    )

    for sp_expense in expenses:
        _import_expense(
            actor=actor, group=group, sp_expense=sp_expense,
            participants=participants_by_expense.get(sp_expense["id"], []),
            sp_to_participant=sp_to_participant, summary=summary,
        )

    _apply_archived_state(group=group, sp_group=sp_group)


def _apply_archived_state(*, group: Group, sp_group: dict) -> None:
    archived_at = sp_group.get("archivedAt")
    if not archived_at:
        return
    group.archived_at = archived_at
    group.save(update_fields=["archived_at", "updated_at"])


def _build_participant_map(*, client: SplitProClient, actor, group: Group,
                           actor_sp_id: int,
                           sp_user_ids: Iterable[int]) -> dict[int, Participant]:
    mapping: dict[int, Participant] = {
        actor_sp_id: get_or_create_user_participant(actor),
    }
    other_ids = [uid for uid in sp_user_ids if uid != actor_sp_id]
    if not other_ids:
        return mapping
    users = client.get_users(other_ids)
    users_by_id = {int(user["id"]): user for user in users}
    for sp_user_id in other_ids:
        sp_user = users_by_id.get(sp_user_id) or {"id": sp_user_id}
        display_name = _format_user_name(sp_user)
        participant = add_unregistered_participant(
            actor=actor, group=group, display_name=display_name,
        )
        mapping[sp_user_id] = participant
    return mapping


# ---------------------------------------------------------------------------
# friends-as-groups import
# ---------------------------------------------------------------------------


def _import_friend_groups(*, client: SplitProClient, actor, actor_sp_id: int,
                          fallback_currency: str,
                          summary: ImportSummary) -> None:
    """Recreate Split Pro non-group expenses as one Splex group per friend.

    Only two-person non-group expenses (the canonical "friend expense"
    shape in Split Pro) are imported.  Anything with three or more
    participants has no clean Splex equivalent without inventing a group
    name, so we count it as skipped rather than risk wrong balances.
    """
    non_group_expenses = client.get_friend_expenses(actor_sp_id)
    if not non_group_expenses:
        return
    participants_by_expense = client.get_participants_for_expenses(
        [expense["id"] for expense in non_group_expenses]
    )

    # Group expenses by the other participant, filtering to 2-person rows.
    expenses_by_friend: dict[int, list[tuple[dict, list[dict]]]] = {}
    for sp_expense in non_group_expenses:
        participants = participants_by_expense.get(sp_expense["id"], [])
        if len(participants) != 2:
            summary.skipped_expenses += 1
            continue
        other_ids = [p["userId"] for p in participants if p["userId"] != actor_sp_id]
        if len(other_ids) != 1:
            summary.skipped_expenses += 1
            continue
        expenses_by_friend.setdefault(other_ids[0], []).append((sp_expense, participants))

    if not expenses_by_friend:
        return

    other_users = client.get_users(expenses_by_friend.keys())
    users_by_id = {int(user["id"]): user for user in other_users}

    for friend_sp_id, items in expenses_by_friend.items():
        sp_friend = users_by_id.get(friend_sp_id) or {"id": friend_sp_id}
        friend_name = _format_user_name(sp_friend)
        currency = _pick_currency_from_expenses(
            (expense for expense, _ in items), fallback_currency,
        )
        group = create_group(
            actor=actor, name=friend_name[:180], default_currency=currency,
        )
        summary.groups_created += 1
        friend_participant = add_unregistered_participant(
            actor=actor, group=group, display_name=friend_name,
        )
        sp_to_participant = {
            actor_sp_id: get_or_create_user_participant(actor),
            friend_sp_id: friend_participant,
        }
        for sp_expense, participants in items:
            _import_expense(
                actor=actor, group=group, sp_expense=sp_expense,
                participants=participants,
                sp_to_participant=sp_to_participant, summary=summary,
            )


# ---------------------------------------------------------------------------
# expense import
# ---------------------------------------------------------------------------


def _import_expense(*, actor, group: Group, sp_expense: dict,
                    participants: list[dict],
                    sp_to_participant: dict[int, Participant],
                    summary: ImportSummary) -> None:
    if sp_expense.get("deletedAt"):
        return
    split_type = (sp_expense.get("splitType") or "").upper()
    if split_type == _CURRENCY_CONVERSION_SPLIT_TYPE:
        # Cross-currency conversions are an internal Split-Pro bookkeeping
        # construct paired via ``conversionToId``.  Splex has no equivalent
        # so we skip them rather than create misleading expenses.
        summary.skipped_expenses += 1
        return
    if not participants:
        summary.skipped_expenses += 1
        return

    currency = _expense_currency(sp_expense, fallback=group.default_currency)
    total = _bigint_to_decimal(sp_expense.get("amount"), currency)
    if total is None or total <= Decimal("0"):
        summary.skipped_expenses += 1
        return

    paid_by = sp_expense.get("paidBy")
    if paid_by is None:
        summary.skipped_expenses += 1
        return

    # Make sure every referenced user is in our participant map; if not we
    # cannot place the expense at all.
    if any(p["userId"] not in sp_to_participant for p in participants):
        summary.skipped_expenses += 1
        return
    if paid_by not in sp_to_participant:
        summary.skipped_expenses += 1
        return

    if split_type == _SETTLEMENT_SPLIT_TYPE:
        _import_settlement(
            actor=actor, group=group, sp_expense=sp_expense,
            participants=participants, sp_to_participant=sp_to_participant,
            total=total, currency=currency, summary=summary,
        )
        return

    payer_shares_native, owed_shares_native = _split_into_paid_owed(
        total=total, participants=participants, paid_by=paid_by,
        currency=currency,
    )
    if not payer_shares_native or not owed_shares_native:
        summary.skipped_expenses += 1
        return

    expense_date = _coerce_date(sp_expense.get("expenseDate"))
    # Imported expense rows bypass create_expense, so resolve the same
    # expense-date rate here and persist the actual rate date used.
    converted_total, rate = convert_for_rate_date(
        total,
        currency,
        group.default_currency,
        expense_date,
    )
    paid_shares = _scale_shares(
        native_shares=payer_shares_native, target_total=converted_total,
        sp_to_participant=sp_to_participant,
    )
    owed_shares = _scale_shares(
        native_shares=owed_shares_native, target_total=converted_total,
        sp_to_participant=sp_to_participant,
    )
    if not paid_shares or not owed_shares:
        summary.skipped_expenses += 1
        return

    description = (sp_expense.get("name") or "Imported expense")[:240]

    expense = Expense.objects.create(
        group=group,
        description=description,
        date=expense_date,
        original_amount=total,
        original_currency=currency,
        converted_amount=converted_total,
        converted_currency=group.default_currency,
        exchange_rate=rate.rate,
        exchange_rate_source=rate.source,
        exchange_rate_date=rate.rate_date,
        split_method=Expense.SplitMethod.EXACT,
        split_metadata={
            "shares": [
                {"participant_id": pid, "amount": str(amount)}
                for pid, amount in _native_shares_by_participant(
                    native_shares=owed_shares_native,
                    sp_to_participant=sp_to_participant,
                ).items()
            ]
        },
        created_by=actor,
    )
    ExpensePaymentShare.objects.bulk_create([
        ExpensePaymentShare(
            expense=expense, participant_id=pid, amount=amount,
            currency=group.default_currency,
        )
        for pid, amount in paid_shares.items()
    ])
    ExpenseOwedShare.objects.bulk_create([
        ExpenseOwedShare(
            expense=expense, participant_id=pid, amount=amount,
            currency=group.default_currency,
        )
        for pid, amount in owed_shares.items()
    ])
    summary.expenses_imported += 1


def _import_settlement(*, actor, group: Group, sp_expense: dict,
                       participants: list[dict],
                       sp_to_participant: dict[int, Participant],
                       total: Decimal, currency: str,
                       summary: ImportSummary) -> None:
    """Convert a Split-Pro SETTLEMENT expense into a Splex Settlement row."""
    payer_id = sp_expense.get("paidBy")
    receivers = [p["userId"] for p in participants if p["userId"] != payer_id]
    if not receivers or payer_id is None:
        summary.skipped_expenses += 1
        return
    receiver_sp_id = receivers[0]
    settlement_date = _coerce_date(sp_expense.get("expenseDate"))
    converted_total, rate = convert_for_rate_date(
        total,
        currency,
        group.default_currency,
        settlement_date,
    )
    Settlement.objects.create(
        group=group,
        payer_participant_id=sp_to_participant[payer_id].id,
        receiver_participant_id=sp_to_participant[receiver_sp_id].id,
        original_amount=total,
        original_currency=currency,
        amount=converted_total,
        currency=group.default_currency,
        exchange_rate=rate.rate,
        exchange_rate_source=rate.source,
        kind=Settlement.Kind.MANUAL,
        created_by=actor,
    )
    summary.settlements_imported += 1


def _split_into_paid_owed(*, total: Decimal, participants: list[dict],
                          paid_by: int, currency: str
                          ) -> tuple[dict[int, Decimal], dict[int, Decimal]]:
    """Recover per-user paid/owed amounts from Split-Pro participant nets.

    Split-Pro stores each participant's net (``paid - owed``) as a BigInt in
    the smallest currency unit.  We rescale onto the same units as ``total``
    (Decimal major units) and then back out the owed share, knowing that the
    payer carries the full expense on the paid side and everyone else paid
    zero:

        owed = (total if user == paid_by else 0) - net
    """
    divisor = _currency_divisor(currency)
    payer_shares: dict[int, Decimal] = {paid_by: total}
    owed_shares: dict[int, Decimal] = {}
    for participant in participants:
        sp_user_id = participant["userId"]
        net_bigint = _decimal_from(participant.get("amount"))
        if net_bigint is None:
            return {}, {}
        net = money(net_bigint / divisor)
        owed_amount = (total if sp_user_id == paid_by else Decimal("0")) - net
        if owed_amount < Decimal("0"):
            # Rounding can push a near-zero share slightly negative.  Clamp.
            owed_amount = Decimal("0")
        if owed_amount > 0:
            owed_shares[sp_user_id] = owed_amount
    return payer_shares, owed_shares


def _scale_shares(*, native_shares: dict[int, Decimal], target_total: Decimal,
                  sp_to_participant: dict[int, Participant]) -> dict[int, Decimal]:
    """Scale per-user amounts onto ``target_total`` and quantize to cents.

    Mirrors ``splitwise_service._scale_shares``: rounding drift is absorbed
    into the largest share so the sum equals ``target_total`` exactly.
    """
    raw_total = sum(native_shares.values(), Decimal("0"))
    if raw_total <= 0:
        return {}
    scaled: dict[int, Decimal] = {}
    scaled_total = Decimal("0")
    for sp_user_id, amount in native_shares.items():
        if amount <= 0:
            continue
        participant_id = sp_to_participant[sp_user_id].id
        share = money(target_total * amount / raw_total)
        scaled[participant_id] = share
        scaled_total += share
    if not scaled:
        return {}
    drift = money(target_total) - scaled_total
    if drift != 0:
        largest_pid = max(scaled, key=lambda pid: scaled[pid])
        scaled[largest_pid] = money(scaled[largest_pid] + drift)
    return scaled


def _native_shares_by_participant(*, native_shares: dict[int, Decimal],
                                  sp_to_participant: dict[int, Participant]
                                  ) -> dict[int, Decimal]:
    return {
        sp_to_participant[sp_user_id].id: money(amount)
        for sp_user_id, amount in native_shares.items()
        if amount > 0
    }


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _format_user_name(sp_user: dict) -> str:
    name = (sp_user.get("name") or "").strip()
    if name:
        return name[:150]
    email = (sp_user.get("email") or "").strip()
    if email:
        return email[:150]
    return f"Split Pro user {sp_user.get('id')}"


def _expense_currency(sp_expense: dict, fallback: str) -> str:
    code = (sp_expense.get("currency") or "").upper().strip()
    return code or fallback


def _pick_currency_from_expenses(expenses: Iterable[dict],
                                 fallback: str) -> str:
    counts: Counter = Counter()
    for expense in expenses:
        code = (expense.get("currency") or "").upper().strip()
        if code:
            counts[code] += 1
    if not counts:
        return fallback
    return counts.most_common(1)[0][0]


def _bigint_to_decimal(value, currency: str) -> Decimal | None:
    if value is None:
        return None
    try:
        cents = int(value)
    except (TypeError, ValueError):
        return None
    divisor = _currency_divisor(currency)
    return money(Decimal(cents) / divisor)


def _currency_divisor(currency: str) -> Decimal:
    code = currency.upper().strip()
    if code in _CURRENCY_DECIMALS_ZERO:
        return Decimal("1")
    if code in _CURRENCY_DECIMALS_THREE:
        return Decimal("1000")
    return Decimal("100")


def _decimal_from(value) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(int(value))
    except (TypeError, ValueError, ArithmeticError):
        return None


def _coerce_date(value):
    if not value:
        return timezone.localdate()
    if hasattr(value, "date"):
        return value.date()
    return value

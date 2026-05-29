"""Import a user's Splitwise data into Splex.

The flow:

* call ``/get_current_user`` to learn the Splitwise user id of the authenticated
  Splitwise account - we use that to map shares onto the requesting Splex user;
* for each Splitwise *group* (skipping the synthetic id=0 "Non-group expenses"
  bucket), create a new Splex group, mirror the members as unregistered
  participants and walk every expense paginated from ``/get_expenses``;
* (opt-in) for each Splitwise *friend*, create a two-person Splex group with
  an unregistered participant for the friend.  Splex friend balances are
  separate from group balances and only registered users can be friends, so
  the workaround group holds only the expenses split directly with that
  friend outside of any Splitwise group.

Splitwise expenses carry their own ``currency_code`` per row.  We pick a single
group currency (the most common one in the imported expenses, falling back to
the user's default) and convert each expense onto that currency, mirroring the
behavior of ``create_expense``.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable
from decimal import Decimal

from django.db import transaction
from django.utils.dateparse import parse_date, parse_datetime

from splex.currency.services import convert
from splex.expenses.models import Expense, ExpenseOwedShare, ExpensePaymentShare
from splex.groups.models import Group
from splex.groups.services import add_unregistered_participant, create_group
from splex.imports.splitwise_client import SplitwiseClient
from splex.imports.summary import ImportSummary
from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant
from splex.settlements.models import Settlement
from splex.shared.money import money

# Splitwise exposes a synthetic group with id=0 holding all "non-group"
# (friend-only) expenses.  We skip it because the friends loop covers the
# same expenses with proper friend grouping.
NON_GROUP_BUCKET_ID = 0


def import_from_splitwise(*, actor, api_key: str,
                          import_friends_as_groups: bool = False,
                          client: SplitwiseClient | None = None
                          ) -> ImportSummary:
    """Pull the actor's Splitwise data and mirror it into Splex.

    The whole import runs in a single DB transaction so a failure halfway
    through does not leave the user with a partially-populated account.

    ``import_friends_as_groups`` controls whether Splitwise friend-only
    expenses are imported.  Splex friend balances are entirely separate from
    group balances and only registered users can be friends, so we cannot map
    Splitwise friends (often unregistered) onto Splex friends directly.  The
    workaround is to create a dedicated two-person group per Splitwise friend
    that holds only the expenses split directly with that friend outside of
    any Splitwise group - opt-in, off by default.
    """
    client = client or SplitwiseClient(api_key)
    current_user = client.get_current_user()
    sw_current_user_id = current_user.get("id")
    if sw_current_user_id is None:
        from splex.imports.splitwise_client import SplitwiseAuthError

        raise SplitwiseAuthError("Could not identify the Splitwise user.")

    summary = ImportSummary()
    actor_default_currency = (actor.default_currency or "EUR").upper()

    with transaction.atomic():
        sw_groups = client.get_groups()
        for sw_group in sw_groups:
            if sw_group.get("id") == NON_GROUP_BUCKET_ID:
                continue
            _import_group(
                client=client,
                actor=actor,
                sw_group=sw_group,
                sw_current_user_id=sw_current_user_id,
                fallback_currency=actor_default_currency,
                summary=summary,
            )

        if import_friends_as_groups:
            sw_friends = client.get_friends()
            for sw_friend in sw_friends:
                _import_friend_as_group(
                    client=client,
                    actor=actor,
                    sw_friend=sw_friend,
                    sw_current_user_id=sw_current_user_id,
                    fallback_currency=actor_default_currency,
                    summary=summary,
                )

    return summary


def _format_user_name(sw_user: dict) -> str:
    first = (sw_user.get("first_name") or "").strip()
    last = (sw_user.get("last_name") or "").strip()
    name = " ".join(part for part in (first, last) if part)
    if name:
        return name[:150]
    email = (sw_user.get("email") or "").strip()
    if email:
        return email[:150]
    return "Splitwise user"


def _pick_group_currency(expenses: Iterable[dict], fallback: str) -> str:
    counts: Counter = Counter()
    for expense in expenses:
        code = (expense.get("currency_code") or "").upper()
        if code:
            counts[code] += 1
    if not counts:
        return fallback
    # ``Counter.most_common`` returns deterministic ordering for ties (insertion).
    return counts.most_common(1)[0][0]


def _import_group(*, client: SplitwiseClient, actor, sw_group: dict,
                  sw_current_user_id: int, fallback_currency: str,
                  summary: ImportSummary) -> None:
    expenses = list(client.iter_expenses(group_id=sw_group["id"]))
    currency = _pick_group_currency(expenses, fallback_currency)
    group = create_group(
        actor=actor,
        name=(sw_group.get("name") or "Splitwise group")[:180],
        default_currency=currency,
    )
    summary.groups_created += 1

    sw_to_participant = {sw_current_user_id: get_or_create_user_participant(actor)}
    for sw_member in sw_group.get("members") or []:
        sw_user_id = sw_member.get("id")
        if sw_user_id is None or sw_user_id == sw_current_user_id:
            continue
        participant = add_unregistered_participant(
            actor=actor, group=group, display_name=_format_user_name(sw_member)
        )
        sw_to_participant[sw_user_id] = participant

    for sw_expense in expenses:
        _import_expense(
            actor=actor, group=group, sw_expense=sw_expense,
            sw_to_participant=sw_to_participant, summary=summary,
        )


def _import_friend_as_group(*, client: SplitwiseClient, actor, sw_friend: dict,
                            sw_current_user_id: int, fallback_currency: str,
                            summary: ImportSummary) -> None:
    friend_id = sw_friend.get("id")
    if friend_id is None or friend_id == sw_current_user_id:
        return
    # ``/get_expenses?friend_id=X`` returns every expense involving that friend
    # - including ones that live inside a shared group, which the group loop
    # already imported.  Splex models friend balances within their group, so
    # keep only the friend-only rows (``group_id`` null or the synthetic 0
    # bucket) to avoid double-importing.
    expenses = [
        sw_expense
        for sw_expense in client.iter_expenses(friend_id=friend_id)
        if not sw_expense.get("group_id")
    ]
    if not expenses:
        # No friend-only history - importing an empty group would just be
        # noise.  Skip it.
        return
    currency = _pick_group_currency(expenses, fallback_currency)
    friend_name = _format_user_name(sw_friend)
    group = create_group(
        actor=actor,
        name=friend_name[:180],
        default_currency=currency,
    )
    summary.groups_created += 1

    friend_participant = add_unregistered_participant(
        actor=actor, group=group, display_name=friend_name
    )
    sw_to_participant = {
        sw_current_user_id: get_or_create_user_participant(actor),
        friend_id: friend_participant,
    }

    for sw_expense in expenses:
        _import_expense(
            actor=actor, group=group, sw_expense=sw_expense,
            sw_to_participant=sw_to_participant, summary=summary,
        )


def _import_expense(*, actor, group: Group, sw_expense: dict,
                    sw_to_participant: dict[int, Participant],
                    summary: ImportSummary) -> None:
    if sw_expense.get("deleted_at"):
        return
    sw_users = sw_expense.get("users") or []
    if not sw_users:
        summary.skipped_expenses += 1
        return

    participant_map = _ensure_participants_for_expense(
        actor=actor, group=group, sw_users=sw_users,
        sw_to_participant=sw_to_participant,
    )
    if participant_map is None:
        summary.skipped_expenses += 1
        return

    cost = sw_expense.get("cost")
    if cost is None:
        summary.skipped_expenses += 1
        return
    try:
        original_amount = money(cost)
    except (ValueError, ArithmeticError):
        summary.skipped_expenses += 1
        return
    if original_amount <= Decimal("0"):
        summary.skipped_expenses += 1
        return

    original_currency = (sw_expense.get("currency_code") or group.default_currency).upper()
    converted_amount, rate = convert(original_amount, original_currency, group.default_currency)

    date = _coerce_date(sw_expense.get("date")) or _coerce_date(sw_expense.get("created_at"))
    description = (sw_expense.get("description") or "Imported expense")[:240]

    if sw_expense.get("payment"):
        _create_settlement_from_payment(
            actor=actor, group=group, sw_expense=sw_expense,
            participant_map=participant_map,
            converted_amount=converted_amount, currency=group.default_currency,
        )
        summary.settlements_imported += 1
        return

    paid_shares = _scale_shares(
        sw_users=sw_users, key="paid_share", participant_map=participant_map,
        target_total=converted_amount,
    )
    owed_shares = _scale_shares(
        sw_users=sw_users, key="owed_share", participant_map=participant_map,
        target_total=converted_amount,
    )
    if not paid_shares or not owed_shares:
        summary.skipped_expenses += 1
        return

    expense = Expense.objects.create(
        group=group,
        description=description,
        date=date,
        original_amount=original_amount,
        original_currency=original_currency,
        converted_amount=converted_amount,
        converted_currency=group.default_currency,
        exchange_rate=rate.rate,
        exchange_rate_source=rate.source,
        split_method=Expense.SplitMethod.EXACT,
        split_metadata={
            "shares": [
                {"participant_id": pid, "amount": str(amount)}
                for pid, amount in owed_shares.items()
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


def _create_settlement_from_payment(*, actor, group: Group, sw_expense: dict,
                                    participant_map: dict[int, Participant],
                                    converted_amount: Decimal,
                                    currency: str) -> None:
    """Map a Splitwise ``payment`` expense onto a single Splex Settlement.

    Splitwise records a payment as a normal expense with ``payment=True`` and a
    single non-zero ``paid_share`` (the payer) plus a single non-zero
    ``owed_share`` (the receiver).  Mirror those onto a settlement row so the
    imported balances match what the user saw in Splitwise.
    """
    payer_id = None
    receiver_id = None
    for sw_user in sw_expense.get("users") or []:
        sw_user_id = (sw_user.get("user") or {}).get("id") or sw_user.get("user_id")
        participant = participant_map.get(sw_user_id) if sw_user_id is not None else None
        if participant is None:
            continue
        paid = _decimal_or_zero(sw_user.get("paid_share"))
        owed = _decimal_or_zero(sw_user.get("owed_share"))
        if paid > 0 and payer_id is None:
            payer_id = participant.id
        if owed > 0 and receiver_id is None:
            receiver_id = participant.id
    if payer_id is None or receiver_id is None or payer_id == receiver_id:
        return
    Settlement.objects.create(
        group=group,
        payer_participant_id=payer_id,
        receiver_participant_id=receiver_id,
        amount=converted_amount,
        currency=currency,
        kind=Settlement.Kind.MANUAL,
        created_by=actor,
    )


def _ensure_participants_for_expense(*, actor, group: Group,
                                     sw_users: list[dict],
                                     sw_to_participant: dict[int, Participant]
                                     ) -> dict[int, Participant] | None:
    """Return ``{sw_user_id: Participant}`` for every user referenced by the
    expense, creating unregistered placeholders for any user not already in
    the group's mapping.  Returns ``None`` if a user record is unusable.
    """
    mapping: dict[int, Participant] = {}
    for sw_user in sw_users:
        user_obj = sw_user.get("user") or {}
        sw_user_id = user_obj.get("id") or sw_user.get("user_id")
        if sw_user_id is None:
            return None
        participant = sw_to_participant.get(sw_user_id)
        if participant is None:
            participant = add_unregistered_participant(
                actor=actor, group=group,
                display_name=_format_user_name(user_obj),
            )
            sw_to_participant[sw_user_id] = participant
        mapping[sw_user_id] = participant
    return mapping


def _scale_shares(*, sw_users: list[dict], key: str,
                  participant_map: dict[int, Participant],
                  target_total: Decimal) -> dict[int, Decimal]:
    """Convert Splitwise per-user shares (in the original currency) onto the
    group's currency while guaranteeing the result sums to ``target_total``.

    Strategy: convert each share by the original-to-target ratio, then absorb
    any rounding drift into the largest share.  Zero shares stay omitted so we
    do not store noise rows.
    """
    raw_amounts: dict[int, Decimal] = {}
    raw_total = Decimal("0")
    for sw_user in sw_users:
        user_obj = sw_user.get("user") or {}
        sw_user_id = user_obj.get("id") or sw_user.get("user_id")
        participant = participant_map.get(sw_user_id)
        if participant is None:
            continue
        amount = _decimal_or_zero(sw_user.get(key))
        if amount <= 0:
            continue
        raw_amounts[participant.id] = amount
        raw_total += amount
    if raw_total <= 0:
        return {}

    scaled: dict[int, Decimal] = {}
    scaled_total = Decimal("0")
    for participant_id, amount in raw_amounts.items():
        share = money(target_total * amount / raw_total)
        scaled[participant_id] = share
        scaled_total += share
    drift = money(target_total) - scaled_total
    if drift != 0:
        # Absorb rounding into the largest share so the sum matches exactly.
        largest_pid = max(scaled, key=lambda pid: scaled[pid])
        scaled[largest_pid] = money(scaled[largest_pid] + drift)
    return scaled


def _decimal_or_zero(value) -> Decimal:
    if value in (None, ""):
        return Decimal("0")
    try:
        return Decimal(str(value))
    except (ValueError, ArithmeticError):
        return Decimal("0")


def _coerce_date(value):
    if not value:
        return None
    dt = parse_datetime(value)
    if dt is not None:
        return dt.date()
    return parse_date(value)

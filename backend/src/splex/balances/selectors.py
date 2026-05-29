from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from splex.expenses.models import Expense
from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant, participant_avatar_url
from splex.settlements.models import Settlement
from splex.shared.money import money


def _expense_debt_rows(expenses):
    debts: dict[tuple[int, int], Decimal] = defaultdict(lambda: Decimal("0.00"))
    for expense in expenses:
        payments = list(expense.payment_shares.all())
        owed_shares = list(expense.owed_shares.all())
        total_paid = sum((payment.amount for payment in payments), Decimal("0.00"))
        if total_paid == 0:
            continue
        for owed in owed_shares:
            for payment in payments:
                if owed.participant_id == payment.participant_id:
                    continue
                allocated = money(owed.amount * payment.amount / total_paid)
                debts[(owed.participant_id, payment.participant_id)] += allocated
    return debts


def _net_debts(debts):
    normalized: dict[tuple[int, int], Decimal] = defaultdict(lambda: Decimal("0.00"))
    handled: set[tuple[int, int]] = set()
    # Snapshot keys: reading `debts[(reverse_key)]` below mutates the defaultdict.
    for debtor_id, creditor_id in list(debts.keys()):  # noqa: S7504
        if debtor_id == creditor_id or (debtor_id, creditor_id) in handled:
            continue
        forward = debts[(debtor_id, creditor_id)]
        reverse = debts[(creditor_id, debtor_id)]
        net = money(forward - reverse)
        handled.add((debtor_id, creditor_id))
        handled.add((creditor_id, debtor_id))
        if net > 0:
            normalized[(debtor_id, creditor_id)] = net
        elif net < 0:
            normalized[(creditor_id, debtor_id)] = money(abs(net))
    return normalized


def _context_debts(expenses, settlements):
    debts = _expense_debt_rows(expenses)
    for settlement in settlements:
        key = (settlement.payer_participant_id, settlement.receiver_participant_id)
        debts[key] -= settlement.amount
    return _net_debts(debts)


# Treat anything below this absolute value as "noise" left over from
# rounding when comparing money totals.  Half a cent is well below the
# smallest representable amount (one cent) so it cannot mask a real debt.
_BALANCE_EPSILON = Decimal("0.005")


def simplified_debts(debts):
    """Reduce a pair-wise debt graph to the minimum-transaction equivalent.

    Standard "greedy net-out" reduction: collapse each participant's
    incoming/outgoing into a single net position, then repeatedly settle
    the largest creditor against the largest debtor until every net is
    zero.  This is the smallest set of transactions that produces the same
    final balances for every participant; it never increases the number
    of edges, and it always equals the original in total money flow.

    Determinism: the output dict is built in a defined iteration order
    (highest creditor first, lower participant id breaking ties) so the
    same input always produces the same edges and amounts.  This matters
    for the UI, which renders the result without re-sorting.
    """
    nets: dict[int, Decimal] = defaultdict(lambda: Decimal("0.00"))
    for (debtor_id, creditor_id), amount in debts.items():
        nets[debtor_id] -= amount
        nets[creditor_id] += amount

    creditors = sorted(
        ((pid, money(amt)) for pid, amt in nets.items() if amt > _BALANCE_EPSILON),
        key=lambda row: (-row[1], row[0]),
    )
    debtors = sorted(
        ((pid, money(amt)) for pid, amt in nets.items() if amt < -_BALANCE_EPSILON),
        key=lambda row: (row[1], row[0]),
    )

    result: dict[tuple[int, int], Decimal] = {}
    creditor_index = 0
    debtor_index = 0
    while creditor_index < len(creditors) and debtor_index < len(debtors):
        cred_id, cred_amt = creditors[creditor_index]
        deb_id, deb_amt = debtors[debtor_index]
        # ``-deb_amt`` since the debtor's net is stored as a negative number.
        pay = money(min(cred_amt, -deb_amt))
        if pay <= Decimal("0.00"):
            break
        result[(deb_id, cred_id)] = pay
        cred_amt = money(cred_amt - pay)
        deb_amt = money(deb_amt + pay)
        if cred_amt <= _BALANCE_EPSILON:
            creditor_index += 1
        else:
            creditors[creditor_index] = (cred_id, cred_amt)
        if deb_amt >= -_BALANCE_EPSILON:
            debtor_index += 1
        else:
            debtors[debtor_index] = (deb_id, deb_amt)
    return result


def group_debts(group):
    expenses = Expense.objects.filter(group=group, deleted_at__isnull=True).prefetch_related(
        "payment_shares", "owed_shares"
    )
    settlements = Settlement.objects.filter(group=group, deleted_at__isnull=True)
    return _context_debts(expenses, settlements)


def friendship_debts(friendship):
    expenses = Expense.objects.filter(
        friendship=friendship, deleted_at__isnull=True
    ).prefetch_related("payment_shares", "owed_shares")
    settlements = Settlement.objects.filter(friendship=friendship, deleted_at__isnull=True)
    return _context_debts(expenses, settlements)


def group_pair_balances_for_user(group, user):
    current = get_or_create_user_participant(user)
    balances: dict[int, Decimal] = defaultdict(lambda: Decimal("0.00"))
    for (debtor_id, creditor_id), amount in group_debts(group).items():
        if creditor_id == current.id:
            balances[debtor_id] += amount
        elif debtor_id == current.id:
            balances[creditor_id] -= amount
    return {participant_id: money(amount) for participant_id, amount in balances.items()}


def group_member_balance_rows(group, *, simplified: bool = False):
    """Return one row per active group member with their net balance and a
    breakdown of who owes them / who they owe.

    When ``simplified`` is true, the breakdown is the minimum-transaction
    settlement set (see :func:`simplified_debts`).  Each participant's net
    total stays identical between the two modes - simplification only
    rearranges the edges between participants, not the totals.
    """
    participant_ids = list(
        group.memberships.filter(removed_at__isnull=True).values_list("participant_id", flat=True)
    )
    participants = Participant.objects.filter(id__in=participant_ids).select_related("user")
    names = {participant.id: participant.effective_display_name for participant in participants}
    avatars = {participant.id: participant_avatar_url(participant) for participant in participants}
    # The frontend uses this to decide whether to show the "Remind to settle"
    # button - reminders can only be sent to registered users (push endpoints
    # are owned by users, not by placeholder participants).
    user_ids = {participant.id: participant.user_id for participant in participants}
    totals: dict[int, Decimal] = defaultdict(lambda: Decimal("0.00"))
    details_by_participant: dict[int, list[dict]] = defaultdict(list)
    raw_debts = group_debts(group)
    breakdown_debts = simplified_debts(raw_debts) if simplified else raw_debts
    # Totals always come from the raw, pre-simplification graph: simplification
    # rearranges edges between participants, it doesn't change anyone's net.
    for (debtor_id, creditor_id), amount in raw_debts.items():
        amount = money(amount)
        totals[debtor_id] -= amount
        totals[creditor_id] += amount
    for (debtor_id, creditor_id), amount in breakdown_debts.items():
        amount = money(amount)
        detail = {
            "from_participant_id": debtor_id,
            "from_display_name": names.get(debtor_id, ""),
            "from_user_id": user_ids.get(debtor_id),
            "to_participant_id": creditor_id,
            "to_display_name": names.get(creditor_id, ""),
            "to_user_id": user_ids.get(creditor_id),
            "amount": str(amount),
            "currency": group.default_currency,
        }
        details_by_participant[debtor_id].append(detail)
        details_by_participant[creditor_id].append(detail)
    return [
        {
            "participant_id": participant_id,
            "display_name": names.get(participant_id, ""),
            "avatar_url": avatars.get(participant_id, ""),
            # ``user_id`` is ``null`` for unregistered placeholders; the UI
            # uses it to gate the "Remind to settle" button on the row, which
            # only makes sense for registered participants that have a push
            # endpoint.
            "user_id": user_ids.get(participant_id),
            "amount": str(money(totals[participant_id])),
            "currency": group.default_currency,
            "details": details_by_participant[participant_id],
        }
        for participant_id in participant_ids
    ]


def participant_outstanding_in_group(group, participant: Participant) -> dict:
    """Return the pair-wise outstanding balances involving `participant` in `group`.

    Used by the "remove member" warning UI and by the auto-settle logic that runs
    when removing a member with non-zero balance.
    """
    debts = group_debts(group)
    relevant_ids: set[int] = set()
    owes: list[dict] = []
    owed_by: list[dict] = []
    for (debtor_id, creditor_id), amount in debts.items():
        if debtor_id == participant.id:
            owes.append({"counterparty_id": creditor_id, "amount": money(amount)})
            relevant_ids.add(creditor_id)
        elif creditor_id == participant.id:
            owed_by.append({"counterparty_id": debtor_id, "amount": money(amount)})
            relevant_ids.add(debtor_id)
    counterparties = {
        p.id: p
        for p in Participant.objects.filter(id__in=relevant_ids).select_related("user")
    }

    def _hydrate(row: dict) -> dict:
        p = counterparties.get(row["counterparty_id"])
        return {
            "participant_id": row["counterparty_id"],
            "display_name": p.effective_display_name if p else "",
            "avatar_url": participant_avatar_url(p) if p else "",
            "amount": str(row["amount"]),
        }

    return {
        "currency": group.default_currency,
        "owes": [_hydrate(row) for row in owes],
        "owed_by": [_hydrate(row) for row in owed_by],
    }


def friendship_balance_for_participant(friendship, current_participant: Participant) -> Decimal:
    other_id = (
        friendship.participant_b_id
        if friendship.participant_a_id == current_participant.id
        else friendship.participant_a_id
    )
    debts = friendship_debts(friendship)
    incoming = debts.get((other_id, current_participant.id), Decimal("0.00"))
    outgoing = debts.get((current_participant.id, other_id), Decimal("0.00"))
    return money(incoming - outgoing)

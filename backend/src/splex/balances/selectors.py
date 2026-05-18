from collections import defaultdict
from decimal import Decimal

from splex.expenses.models import Expense
from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant
from splex.settlements.models import Settlement
from splex.shared.media import signed_media_url
from splex.shared.money import money


def _expense_debt_rows(expenses):
    debts = defaultdict(lambda: Decimal("0.00"))
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
    normalized = defaultdict(lambda: Decimal("0.00"))
    handled = set()
    for debtor_id, creditor_id in list(debts.keys()):
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


def group_debts(group):
    expenses = (
        Expense.objects.filter(group=group, deleted_at__isnull=True)
        .prefetch_related("payment_shares", "owed_shares")
    )
    debts = _expense_debt_rows(expenses)
    settlements = Settlement.objects.filter(group=group, deleted_at__isnull=True)
    for settlement in settlements:
        key = (settlement.payer_participant_id, settlement.receiver_participant_id)
        debts[key] -= settlement.amount
    return _net_debts(debts)


def group_pair_balances_for_user(group, user):
    current = get_or_create_user_participant(user)
    balances = defaultdict(lambda: Decimal("0.00"))
    for (debtor_id, creditor_id), amount in group_debts(group).items():
        if creditor_id == current.id:
            balances[debtor_id] += amount
        elif debtor_id == current.id:
            balances[creditor_id] -= amount
    return {participant_id: money(amount) for participant_id, amount in balances.items()}


def group_member_balance_rows(group):
    participant_ids = list(
        group.memberships.filter(removed_at__isnull=True).values_list("participant_id", flat=True)
    )
    participants = Participant.objects.filter(id__in=participant_ids).select_related("user")
    names = {participant.id: participant.display_name for participant in participants}
    avatars = {
        participant.id: signed_media_url(participant.user.avatar_url)
        for participant in participants
        if participant.user_id and participant.user.avatar_url
    }
    totals = defaultdict(lambda: Decimal("0.00"))
    details_by_participant = defaultdict(list)
    for (debtor_id, creditor_id), amount in group_debts(group).items():
        amount = money(amount)
        totals[debtor_id] -= amount
        totals[creditor_id] += amount
        detail = {
            "from_participant_id": debtor_id,
            "from_display_name": names.get(debtor_id, ""),
            "to_participant_id": creditor_id,
            "to_display_name": names.get(creditor_id, ""),
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
            "amount": str(money(totals[participant_id])),
            "currency": group.default_currency,
            "details": details_by_participant[participant_id],
        }
        for participant_id in participant_ids
    ]


def friendship_balance_for_user(friendship, user):
    current = get_or_create_user_participant(user)
    other_id = (
        friendship.participant_b_id
        if friendship.participant_a_id == current.id
        else friendship.participant_a_id
    )
    balances = defaultdict(lambda: Decimal("0.00"))
    expenses = (
        Expense.objects.filter(friendship=friendship, deleted_at__isnull=True)
        .prefetch_related("payment_shares", "owed_shares")
    )
    for expense in expenses:
        payments = list(expense.payment_shares.all())
        owed_shares = list(expense.owed_shares.all())
        total_paid = sum((payment.amount for payment in payments), Decimal("0.00"))
        if total_paid == 0:
            continue
        for owed in owed_shares:
            for payment in payments:
                allocated = money(owed.amount * payment.amount / total_paid)
                if owed.participant_id == current.id and payment.participant_id != current.id:
                    balances[payment.participant_id] -= allocated
                elif payment.participant_id == current.id and owed.participant_id != current.id:
                    balances[owed.participant_id] += allocated
    for settlement in Settlement.objects.filter(friendship=friendship, deleted_at__isnull=True):
        if settlement.receiver_participant_id == current.id:
            balances[settlement.payer_participant_id] -= settlement.amount
        elif settlement.payer_participant_id == current.id:
            balances[settlement.receiver_participant_id] += settlement.amount
    return money(balances[other_id])

from splex.balances.selectors import friendship_balance_for_participant
from splex.friends.models import Friendship
from splex.friends.services import other_participant
from splex.participants.models import Participant
from splex.participants.services import participant_avatar_url


def serialize_friend(
    friendship: Friendship,
    *,
    current_participant: Participant,
    include_current: bool = False,
) -> dict:
    from splex.expenses.models import Expense

    other = other_participant(friendship, current_participant)
    latest_expense = (
        Expense.objects.filter(friendship=friendship, deleted_at__isnull=True)
        .order_by("-date")
        .first()
    )

    payload = {
        "id": friendship.id,
        "display_name": other.effective_display_name,
        "avatar_url": participant_avatar_url(other),
        "participant_id": other.id,
        "default_currency": friendship.default_currency,
        "balance": str(friendship_balance_for_participant(friendship, current_participant)),
        "last_expense_date": latest_expense.date if latest_expense else None,
    }
    if include_current:
        payload["current_participant_id"] = current_participant.id
    return payload

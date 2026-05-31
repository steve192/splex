from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.balances.selectors import friendship_balance_for_participant
from splex.expenses.models import Expense
from splex.expenses.services import create_expense
from splex.friends.serializers import serialize_friend
from splex.friends.services import (
    accessible_friendships,
    end_friendship,
    ensure_friendship_member,
    other_participant,
    set_friendship_archived,
)
from splex.groups.api.serializers import ExpenseCreateSerializer, SettlementCreateSerializer
from splex.groups.statistics import friendship_statistics
from splex.invitations.services import create_friend_invitation
from splex.ledger.selectors import paginated_ledger_response
from splex.ledger.serializers import serialize_expense, serialize_settlement
from splex.notifications.reminders import (
    send_settle_reminder_in_friendship,
    send_track_expense_reminder_in_friendship,
)
from splex.participants.services import get_or_create_user_participant
from splex.settlements.services import create_settlement


class FriendListView(APIView):
    def get(self, request):
        participant = get_or_create_user_participant(request.user)
        friendships = accessible_friendships(request.user).select_related(
            "participant_a__user", "participant_b__user"
        )
        return Response(
            [
                serialize_friend(friendship, current_participant=participant)
                for friendship in friendships
            ]
        )


class FriendDetailView(APIView):
    def get(self, request, friendship_id):
        friendship, participant = ensure_friendship_member(request.user, friendship_id)
        return Response(
            serialize_friend(friendship, current_participant=participant, include_current=True)
        )

    def patch(self, request, friendship_id):
        friendship, participant = ensure_friendship_member(request.user, friendship_id)
        if "archived" in request.data:
            set_friendship_archived(friendship, participant, bool(request.data["archived"]))
        return Response(
            serialize_friend(friendship, current_participant=participant, include_current=True)
        )

    def delete(self, request, friendship_id):
        friendship, participant = ensure_friendship_member(request.user, friendship_id)
        try:
            end_friendship(request.user, friendship, participant)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class FriendStatisticsView(APIView):
    def get(self, request, friendship_id):
        friendship, _ = ensure_friendship_member(request.user, friendship_id)
        return Response(friendship_statistics(friendship))


class FriendInvitationsView(APIView):
    def post(self, request):
        invitation, token, url = create_friend_invitation(actor=request.user)
        return Response(
            {"id": invitation.id, "token": token, "url": url},
            status=status.HTTP_201_CREATED,
        )


class FriendExpensesView(APIView):
    def get(self, request, friendship_id):
        friendship, _ = ensure_friendship_member(request.user, friendship_id)
        expenses = (
            Expense.objects.filter(friendship=friendship, deleted_at__isnull=True)
            .prefetch_related("payment_shares", "owed_shares", "receipts")
            .order_by("-date", "-created_at")
        )
        return Response([serialize_expense(expense) for expense in expenses])

    def post(self, request, friendship_id):
        friendship, _ = ensure_friendship_member(request.user, friendship_id)
        serializer = ExpenseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = create_expense(
            actor=request.user, friendship=friendship, data=serializer.validated_data
        )
        expense = Expense.objects.prefetch_related("payment_shares", "owed_shares", "receipts").get(
            id=expense.id
        )
        return Response(serialize_expense(expense), status=status.HTTP_201_CREATED)


class FriendLedgerView(APIView):
    def get(self, request, friendship_id):
        friendship, _ = ensure_friendship_member(request.user, friendship_id)
        return Response(
            paginated_ledger_response(
                friendship=friendship,
                limit=request.query_params.get("limit"),
                offset=request.query_params.get("offset"),
            )
        )


class FriendSettlementsView(APIView):
    def post(self, request, friendship_id):
        friendship, _ = ensure_friendship_member(request.user, friendship_id)
        serializer = SettlementCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            settlement = create_settlement(
                actor=request.user,
                friendship=friendship,
                data=serializer.validated_data,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serialize_settlement(settlement), status=status.HTTP_201_CREATED)


class FriendSettleReminderView(APIView):
    """Send a "please settle" push to the other side of the friendship.

    Body: ``{"amount": str, "currency": str}``.  Refuses to send when the
    other side is not actually in the red (we don't want the friend to get
    a nag for money they're owed).
    """

    throttle_scope = "reminders"

    def post(self, request, friendship_id):
        friendship, current_participant = ensure_friendship_member(
            request.user, friendship_id,
        )
        other = other_participant(friendship, current_participant)
        if other.user_id is None:
            return Response(
                {"detail": "Cannot remind an unregistered friend."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        amount = request.data.get("amount")
        currency = (
            (request.data.get("currency") or friendship.default_currency).upper()
        )
        if amount in (None, ""):
            # Default the amount to whatever the friend currently owes so the
            # caller doesn't have to compute it - common case is "tap to nudge".
            balance = friendship_balance_for_participant(friendship, current_participant)
            if balance <= 0:
                return Response(
                    {"detail": "Your friend is not currently in debt."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            amount = str(balance)
        sent, _errors = send_settle_reminder_in_friendship(
            actor=request.user, friendship=friendship, debtor_user=other.user,
            amount=amount, currency=currency,
        )
        return Response({"sent": bool(sent)})


class FriendTrackExpenseReminderView(APIView):
    """Send a "please track your expenses" push to the other side of a
    friendship.  Unregistered friends are rejected (no push endpoint)."""

    throttle_scope = "reminders"

    def post(self, request, friendship_id):
        friendship, current_participant = ensure_friendship_member(
            request.user, friendship_id,
        )
        other = other_participant(friendship, current_participant)
        if other.user_id is None:
            return Response(
                {"detail": "Cannot remind an unregistered friend."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sent, _errors = send_track_expense_reminder_in_friendship(
            actor=request.user, friendship=friendship, other_user=other.user,
        )
        return Response({"sent": bool(sent)})

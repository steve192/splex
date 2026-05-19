from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.expenses.models import Expense
from splex.expenses.services import create_expense
from splex.friends.serializers import serialize_friend
from splex.friends.services import accessible_friendships, ensure_friendship_member
from splex.groups.api.serializers import ExpenseCreateSerializer, SettlementCreateSerializer
from splex.invitations.services import create_friend_invitation
from splex.ledger.selectors import paginated_ledger_response
from splex.ledger.serializers import serialize_expense, serialize_settlement
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
            .prefetch_related("payment_shares", "owed_shares")
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
        expense = Expense.objects.prefetch_related("payment_shares", "owed_shares").get(
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

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.balances.selectors import friendship_balance_for_user
from splex.expenses.models import Expense
from splex.expenses.services import create_expense
from splex.friends.models import Friendship
from splex.groups.api.serializers import ExpenseCreateSerializer, SettlementCreateSerializer
from splex.ledger.serializers import serialize_expense, serialize_ledger_item, serialize_settlement
from splex.invitations.services import create_friend_invitation
from splex.participants.services import get_or_create_user_participant
from splex.settlements.models import Settlement
from splex.settlements.services import create_settlement
from splex.shared.media import signed_media_url


def accessible_friendships(user):
    participant = get_or_create_user_participant(user)
    return Friendship.objects.filter(
        ended_at__isnull=True,
    ).filter(participant_a=participant) | Friendship.objects.filter(
        ended_at__isnull=True,
    ).filter(participant_b=participant)


class FriendListView(APIView):
    def get(self, request):
        participant = get_or_create_user_participant(request.user)
        rows = []
        for friendship in accessible_friendships(request.user).distinct().select_related(
            "participant_a__user", "participant_b__user"
        ):
            other = (
                friendship.participant_b
                if friendship.participant_a_id == participant.id
                else friendship.participant_a
            )
            rows.append(
                {
                    "id": friendship.id,
                    "display_name": other.display_name,
                    "avatar_url": (
                        signed_media_url(other.user.avatar_url)
                        if other.user_id and other.user.avatar_url
                        else ""
                    ),
                    "participant_id": other.id,
                    "currency": friendship.default_currency,
                    "balance": str(friendship_balance_for_user(friendship, request.user)),
                }
            )
        return Response(rows)


class FriendDetailView(APIView):
    def get(self, request, friendship_id):
        participant = get_or_create_user_participant(request.user)
        friendship = Friendship.objects.get(id=friendship_id, ended_at__isnull=True)
        if participant.id not in [friendship.participant_a_id, friendship.participant_b_id]:
            return Response(status=status.HTTP_404_NOT_FOUND)
        other = (
            friendship.participant_b
            if friendship.participant_a_id == participant.id
            else friendship.participant_a
        )
        return Response(
            {
                "id": friendship.id,
                "display_name": other.display_name,
                "avatar_url": (
                    signed_media_url(other.user.avatar_url)
                    if other.user_id and other.user.avatar_url
                    else ""
                ),
                "participant_id": other.id,
                "current_participant_id": participant.id,
                "currency": friendship.default_currency,
                "balance": str(friendship_balance_for_user(friendship, request.user)),
            }
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
        friendship = Friendship.objects.get(id=friendship_id)
        if friendship not in accessible_friendships(request.user):
            return Response(status=status.HTTP_404_NOT_FOUND)
        expenses = (
            Expense.objects.filter(friendship=friendship, deleted_at__isnull=True)
            .prefetch_related("payment_shares", "owed_shares")
            .order_by("-date", "-created_at")
        )
        return Response([serialize_expense(expense) for expense in expenses])

    def post(self, request, friendship_id):
        friendship = Friendship.objects.get(id=friendship_id)
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
        friendship = Friendship.objects.get(id=friendship_id)
        participant = get_or_create_user_participant(request.user)
        if participant.id not in [friendship.participant_a_id, friendship.participant_b_id]:
            return Response(status=status.HTTP_404_NOT_FOUND)
        limit = request.query_params.get("limit")
        offset = request.query_params.get("offset")
        expenses = list(
            Expense.objects.filter(friendship=friendship, deleted_at__isnull=True)
            .prefetch_related("payment_shares", "owed_shares")
        )
        settlements = list(
            Settlement.objects.filter(friendship=friendship, deleted_at__isnull=True).select_related(
                "payer_participant__user", "receiver_participant__user"
            )
        )
        items = sorted(
            [*expenses, *settlements],
            key=lambda item: item.created_at,
            reverse=True,
        )
        if limit is not None or offset is not None:
            resolved_limit = min(int(limit or 50), 100)
            resolved_offset = max(int(offset or 0), 0)
            page = items[resolved_offset : resolved_offset + resolved_limit]
            return Response(
                {
                    "results": [serialize_ledger_item(item) for item in page],
                    "next_offset": (
                        resolved_offset + resolved_limit if len(page) == resolved_limit else None
                    ),
                }
            )
        return Response([serialize_ledger_item(item) for item in items])


class FriendSettlementsView(APIView):
    def post(self, request, friendship_id):
        friendship = Friendship.objects.get(id=friendship_id)
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

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.balances.selectors import group_member_balance_rows, group_pair_balances_for_user
from splex.expenses.models import Expense
from splex.expenses.services import create_expense
from splex.groups.api.serializers import (
    AddParticipantSerializer,
    ExpenseCreateSerializer,
    GroupCreateSerializer,
    GroupSerializer,
    GroupUpdateSerializer,
    InvitationCreateSerializer,
    ParticipantSerializer,
    RenameParticipantSerializer,
    SettlementCreateSerializer,
)
from splex.groups.models import Group
from splex.groups.services import (
    add_unregistered_participant,
    assert_group_member,
    create_group,
    delete_group,
    remove_group_participant,
    rename_unregistered_participant,
    update_group,
)
from splex.invitations.services import create_claim_invitation, create_group_invitation
from splex.ledger.selectors import paginated_ledger_response
from splex.ledger.serializers import serialize_expense, serialize_settlement
from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant
from splex.settlements.services import create_settlement
from splex.shared.media import signed_media_url


def get_active_group(group_id):
    return get_object_or_404(Group, id=group_id, deleted_at__isnull=True)


class OverviewView(APIView):
    def get(self, request):
        groups = Group.objects.filter(
            memberships__participant__user=request.user,
            memberships__removed_at__isnull=True,
            deleted_at__isnull=True,
        ).distinct()
        items = []
        for group in groups:
            balances = group_pair_balances_for_user(group, request.user)
            total = sum(balances.values())
            items.append(
                {
                    "type": "group",
                    "id": group.id,
                    "name": group.name,
                    "icon_url": signed_media_url(group.icon_url),
                    "currency": group.default_currency,
                    "balance": str(total),
                    "archived_at": group.archived_at,
                }
            )
        return Response({"items": items})


class GroupListCreateView(APIView):
    def get(self, request):
        groups = Group.objects.filter(
            memberships__participant__user=request.user,
            memberships__removed_at__isnull=True,
            archived_at__isnull=True,
            deleted_at__isnull=True,
        ).distinct()
        return Response(GroupSerializer(groups, many=True).data)

    def post(self, request):
        serializer = GroupCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = create_group(actor=request.user, **serializer.validated_data)
        return Response(GroupSerializer(group).data, status=status.HTTP_201_CREATED)


class GroupDetailView(APIView):
    def get(self, request, group_id):
        group = get_active_group(group_id)
        assert_group_member(request.user, group)
        participants = Participant.objects.filter(
            group_memberships__group=group,
            group_memberships__removed_at__isnull=True,
        ).select_related("user")
        return Response(
            {
                **GroupSerializer(group).data,
                "current_participant_id": get_or_create_user_participant(request.user).id,
                "participants": ParticipantSerializer(participants, many=True).data,
            }
        )

    def patch(self, request, group_id):
        group = get_active_group(group_id)
        serializer = GroupUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            group = update_group(actor=request.user, group=group, data=serializer.validated_data)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(GroupSerializer(group).data)

    def delete(self, request, group_id):
        group = get_active_group(group_id)
        try:
            delete_group(actor=request.user, group=group)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class GroupParticipantsView(APIView):
    def post(self, request, group_id):
        group = get_active_group(group_id)
        serializer = AddParticipantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        participant = add_unregistered_participant(
            actor=request.user, group=group, **serializer.validated_data
        )
        return Response(ParticipantSerializer(participant).data, status=status.HTTP_201_CREATED)


class GroupParticipantDetailView(APIView):
    def patch(self, request, group_id, participant_id):
        group = get_active_group(group_id)
        participant = Participant.objects.get(id=participant_id)
        serializer = RenameParticipantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            participant = rename_unregistered_participant(
                actor=request.user,
                group=group,
                participant=participant,
                display_name=serializer.validated_data["display_name"],
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ParticipantSerializer(participant).data)

    def delete(self, request, group_id, participant_id):
        group = get_active_group(group_id)
        participant = Participant.objects.get(id=participant_id)
        try:
            remove_group_participant(actor=request.user, group=group, participant=participant)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class GroupBalancesView(APIView):
    def get(self, request, group_id):
        group = get_active_group(group_id)
        assert_group_member(request.user, group)
        return Response(group_member_balance_rows(group))


class GroupExpensesView(APIView):
    def get(self, request, group_id):
        group = get_active_group(group_id)
        assert_group_member(request.user, group)
        expenses = (
            Expense.objects.filter(group=group, deleted_at__isnull=True)
            .prefetch_related("payment_shares", "owed_shares")
            .order_by("-date", "-created_at")
        )
        return Response([serialize_expense(expense) for expense in expenses])

    def post(self, request, group_id):
        group = get_active_group(group_id)
        assert_group_member(request.user, group)
        serializer = ExpenseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = create_expense(actor=request.user, group=group, data=serializer.validated_data)
        expense = Expense.objects.prefetch_related("payment_shares", "owed_shares").get(
            id=expense.id
        )
        return Response(serialize_expense(expense), status=status.HTTP_201_CREATED)


class GroupLedgerView(APIView):
    def get(self, request, group_id):
        group = get_active_group(group_id)
        assert_group_member(request.user, group)
        return Response(
            paginated_ledger_response(
                group=group,
                limit=request.query_params.get("limit"),
                offset=request.query_params.get("offset"),
            )
        )


class GroupSettlementsView(APIView):
    def post(self, request, group_id):
        group = get_active_group(group_id)
        serializer = SettlementCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            settlement = create_settlement(
                actor=request.user,
                group=group,
                data=serializer.validated_data,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serialize_settlement(settlement), status=status.HTTP_201_CREATED)


class GroupInvitationsView(APIView):
    def post(self, request, group_id):
        group = get_active_group(group_id)
        serializer = InvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_id = serializer.validated_data.get("target_participant_id")
        if target_id:
            participant = Participant.objects.get(id=target_id)
            invitation, token, url = create_claim_invitation(
                actor=request.user, group=group, target_participant=participant
            )
        else:
            invitation, token, url = create_group_invitation(actor=request.user, group=group)
        return Response(
            {"id": invitation.id, "token": token, "url": url},
            status=status.HTTP_201_CREATED,
        )

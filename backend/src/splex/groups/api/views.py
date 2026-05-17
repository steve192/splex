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
    create_group,
    delete_group,
    ensure_group_member,
    rename_unregistered_participant,
    remove_group_participant,
    update_group,
)
from splex.invitations.services import create_claim_invitation, create_group_invitation
from splex.participants.models import Participant
from splex.participants.services import get_or_create_user_participant
from splex.settlements.models import Settlement
from splex.settlements.services import create_settlement


def serialize_expense(expense):
    participant_ids = [
        *(share.participant_id for share in expense.payment_shares.all()),
        *(share.participant_id for share in expense.owed_shares.all()),
    ]
    participants = Participant.objects.filter(id__in=participant_ids).select_related("user")
    participant_names = {participant.id: participant.display_name for participant in participants}
    participant_avatars = {
        participant.id: participant.user.avatar_url
        for participant in participants
        if participant.user_id and participant.user.avatar_url
    }
    return {
        "id": expense.id,
        "client_id": expense.client_id,
        "group_id": expense.group_id,
        "friendship_id": expense.friendship_id,
        "description": expense.description,
        "date": expense.date,
        "original_amount": str(expense.original_amount),
        "original_currency": expense.original_currency,
        "converted_amount": str(expense.converted_amount),
        "converted_currency": expense.converted_currency,
        "split_method": expense.split_method,
        "split_payload": expense.split_metadata,
        "deleted_at": expense.deleted_at,
        "payments": [
            {
                "participant_id": share.participant_id,
                "display_name": participant_names.get(share.participant_id, ""),
                "avatar_url": participant_avatars.get(share.participant_id, ""),
                "amount": str(share.amount),
            }
            for share in expense.payment_shares.all()
        ],
        "owed": [
            {
                "participant_id": share.participant_id,
                "display_name": participant_names.get(share.participant_id, ""),
                "avatar_url": participant_avatars.get(share.participant_id, ""),
                "amount": str(share.amount),
            }
            for share in expense.owed_shares.all()
        ],
    }


def serialize_settlement(settlement):
    return {
        "id": settlement.id,
        "group_id": settlement.group_id,
        "friendship_id": settlement.friendship_id,
        "payer_participant_id": settlement.payer_participant_id,
        "receiver_participant_id": settlement.receiver_participant_id,
        "payer_display_name": settlement.payer_participant.display_name,
        "receiver_display_name": settlement.receiver_participant.display_name,
        "payer_avatar_url": (
            settlement.payer_participant.user.avatar_url
            if settlement.payer_participant.user_id
            else ""
        ),
        "receiver_avatar_url": (
            settlement.receiver_participant.user.avatar_url
            if settlement.receiver_participant.user_id
            else ""
        ),
        "amount": str(settlement.amount),
        "currency": settlement.currency,
        "created_at": settlement.created_at,
        "deleted_at": settlement.deleted_at,
    }


def serialize_ledger_item(item):
    if isinstance(item, Expense):
        return {
            "type": "expense",
            "occurred_at": item.created_at.isoformat(),
            "expense": serialize_expense(item),
        }
    return {
        "type": "settlement",
        "occurred_at": item.created_at.isoformat(),
        "settlement": serialize_settlement(item),
    }


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
                    "icon_url": group.icon_url,
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
        ensure_group_member(request.user, group)
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
        ensure_group_member(request.user, group)
        return Response(group_member_balance_rows(group))


class GroupExpensesView(APIView):
    def get(self, request, group_id):
        group = get_active_group(group_id)
        ensure_group_member(request.user, group)
        expenses = (
            Expense.objects.filter(group=group, deleted_at__isnull=True)
            .prefetch_related("payment_shares", "owed_shares")
            .order_by("-date", "-created_at")
        )
        return Response([serialize_expense(expense) for expense in expenses])

    def post(self, request, group_id):
        group = get_active_group(group_id)
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
        ensure_group_member(request.user, group)
        expenses = list(
            Expense.objects.filter(group=group, deleted_at__isnull=True)
            .prefetch_related("payment_shares", "owed_shares")
        )
        settlements = list(
            Settlement.objects.filter(group=group, deleted_at__isnull=True).select_related(
                "payer_participant__user", "receiver_participant__user"
            )
        )
        items = sorted(
            [*expenses, *settlements],
            key=lambda item: item.created_at,
            reverse=True,
        )
        return Response([serialize_ledger_item(item) for item in items])


class GroupSettlementsView(APIView):
    def post(self, request, group_id):
        group = get_active_group(group_id)
        serializer = SettlementCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        settlement = create_settlement(
            actor=request.user,
            group=group,
            data=serializer.validated_data,
        )
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

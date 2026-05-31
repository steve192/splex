from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.balances.selectors import (
    group_member_balance_rows,
    group_pair_balances_for_user,
    participant_outstanding_in_group,
)
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
    add_registered_participant,
    add_unregistered_participant,
    assert_group_member,
    create_group,
    delete_group,
    leave_group,
    remove_group_participant,
    rename_unregistered_participant,
    update_group,
)
from splex.invitations.services import create_claim_invitation, create_group_invitation
from splex.ledger.selectors import paginated_ledger_response
from splex.ledger.serializers import serialize_expense, serialize_settlement
from splex.notifications.reminders import (
    send_settle_reminder_in_group,
    send_track_expense_reminder_in_group,
)
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


class GroupLeaveView(APIView):
    def post(self, request, group_id):
        group = get_active_group(group_id)
        try:
            leave_group(actor=request.user, group=group)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class GroupParticipantsView(APIView):
    def post(self, request, group_id):
        group = get_active_group(group_id)
        serializer = AddParticipantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if "friend_participant_id" in serializer.validated_data:
            friend_participant = get_object_or_404(
                Participant,
                id=serializer.validated_data["friend_participant_id"],
                user__isnull=False,
            )
            try:
                participant = add_registered_participant(
                    actor=request.user,
                    group=group,
                    participant=friend_participant,
                )
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            participant = add_unregistered_participant(
                actor=request.user,
                group=group,
                display_name=serializer.validated_data["display_name"],
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
        simplified = (request.query_params.get("simplified") or "").lower() in {"1", "true"}
        return Response(group_member_balance_rows(group, simplified=simplified))


class GroupSettleReminderView(APIView):
    """Send a "please settle" push to a specific registered group member.

    Body: ``{"participant_id": int, "amount": str, "currency": str}``.  The
    caller must be a group member, the target participant must be in the same
    group and backed by a registered user (we can't push to placeholders),
    and the caller may not nudge themselves.
    """

    throttle_scope = "reminders"

    def post(self, request, group_id):
        group = get_active_group(group_id)
        assert_group_member(request.user, group)
        participant_id = request.data.get("participant_id")
        amount = request.data.get("amount")
        currency = (request.data.get("currency") or group.default_currency).upper()
        if not participant_id or amount in (None, ""):
            return Response(
                {"detail": "participant_id and amount are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        target = get_object_or_404(
            Participant.objects.select_related("user"),
            id=participant_id,
            group_memberships__group=group,
            group_memberships__removed_at__isnull=True,
        )
        if target.user_id is None:
            return Response(
                {"detail": "Cannot remind an unregistered member."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if target.user_id == request.user.id:
            return Response(
                {"detail": "You cannot send yourself a reminder."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sent, _errors = send_settle_reminder_in_group(
            actor=request.user, group=group, debtor_user=target.user,
            amount=amount, currency=currency,
        )
        return Response({"sent": bool(sent)})


class GroupTrackExpenseReminderView(APIView):
    """Send a "please track your expenses" push to every other registered
    member of the group."""

    throttle_scope = "reminders"

    def post(self, request, group_id):
        group = get_active_group(group_id)
        assert_group_member(request.user, group)
        recipients, sent, _errors = send_track_expense_reminder_in_group(
            actor=request.user, group=group,
        )
        return Response({"recipients": recipients, "sent": sent})


class GroupStatisticsView(APIView):
    def get(self, request, group_id):
        from splex.groups.statistics import group_statistics

        group = get_active_group(group_id)
        assert_group_member(request.user, group)
        return Response(group_statistics(group))


class GroupParticipantOutstandingView(APIView):
    def get(self, request, group_id, participant_id):
        group = get_active_group(group_id)
        assert_group_member(request.user, group)
        participant = get_object_or_404(Participant, id=participant_id)
        return Response(participant_outstanding_in_group(group, participant))


class GroupExpensesView(APIView):
    def get(self, request, group_id):
        group = get_active_group(group_id)
        assert_group_member(request.user, group)
        expenses = (
            Expense.objects.filter(group=group, deleted_at__isnull=True)
            .prefetch_related("payment_shares", "owed_shares", "receipts")
            .order_by("-date", "-created_at")
        )
        return Response([serialize_expense(expense) for expense in expenses])

    def post(self, request, group_id):
        group = get_active_group(group_id)
        assert_group_member(request.user, group)
        serializer = ExpenseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        expense = create_expense(actor=request.user, group=group, data=serializer.validated_data)
        expense = Expense.objects.prefetch_related("payment_shares", "owed_shares", "receipts").get(
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

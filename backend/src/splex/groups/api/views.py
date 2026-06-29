from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.balances.selectors import (
    group_member_balance_rows,
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
from splex.shared.errors import DomainError, ErrorCode


def get_active_group(group_id):
    return get_object_or_404(Group, id=group_id, deleted_at__isnull=True)


def user_groups_queryset(user):
    return Group.objects.filter(
        memberships__participant__user=user,
        memberships__removed_at__isnull=True,
        deleted_at__isnull=True,
    ).distinct()


class GroupListCreateView(APIView):
    def get(self, request):
        return Response(
            GroupSerializer(
                user_groups_queryset(request.user),
                many=True,
                context={"user": request.user},
            ).data
        )

    def post(self, request):
        serializer = GroupCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = create_group(actor=request.user, **serializer.validated_data)
        return Response(
            GroupSerializer(group, context={"user": request.user}).data,
            status=status.HTTP_201_CREATED,
        )


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
                **GroupSerializer(group, context={"user": request.user}).data,
                "current_participant_id": get_or_create_user_participant(request.user).id,
                "participants": ParticipantSerializer(participants, many=True).data,
            }
        )

    def patch(self, request, group_id):
        group = get_active_group(group_id)
        serializer = GroupUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = update_group(actor=request.user, group=group, data=serializer.validated_data)
        return Response(GroupSerializer(group, context={"user": request.user}).data)

    def delete(self, request, group_id):
        group = get_active_group(group_id)
        delete_group(actor=request.user, group=group)
        return Response(status=status.HTTP_204_NO_CONTENT)


class GroupLeaveView(APIView):
    def post(self, request, group_id):
        group = get_active_group(group_id)
        leave_group(actor=request.user, group=group)
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
            participant = add_registered_participant(
                actor=request.user,
                group=group,
                participant=friend_participant,
            )
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
        participant = rename_unregistered_participant(
            actor=request.user,
            group=group,
            participant=participant,
            display_name=serializer.validated_data["display_name"],
        )
        return Response(ParticipantSerializer(participant).data)

    def delete(self, request, group_id, participant_id):
        group = get_active_group(group_id)
        participant = Participant.objects.get(id=participant_id)
        remove_group_participant(actor=request.user, group=group, participant=participant)
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
            fields = {}
            if not participant_id:
                fields["participant_id"] = ["This field is required."]
            if amount in (None, ""):
                fields["amount"] = ["This field is required."]
            raise ValidationError(fields)
        target = get_object_or_404(
            Participant.objects.select_related("user"),
            id=participant_id,
            group_memberships__group=group,
            group_memberships__removed_at__isnull=True,
        )
        if target.user_id is None:
            raise DomainError(
                ErrorCode.REMINDER_TARGET_UNREGISTERED,
                "This person cannot receive reminders because they do not have an account.",
            )
        if target.user_id == request.user.id:
            raise DomainError(ErrorCode.REMINDER_SELF, "You cannot send yourself a reminder.")
        sent, _errors = send_settle_reminder_in_group(
            actor=request.user,
            group=group,
            debtor_user=target.user,
            amount=amount,
            currency=currency,
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
            actor=request.user,
            group=group,
        )
        return Response({"recipients": recipients, "sent": sent})


class GroupStatisticsView(APIView):
    def get(self, request, group_id):
        from splex.groups.statistics import group_statistics

        group = get_active_group(group_id)
        assert_group_member(request.user, group)
        return Response(
            group_statistics(
                group,
                current_participant=get_or_create_user_participant(request.user),
                date_from=request.query_params.get("date_from"),
                date_to=request.query_params.get("date_to"),
            )
        )


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
                search=request.query_params.get("search"),
            )
        )


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

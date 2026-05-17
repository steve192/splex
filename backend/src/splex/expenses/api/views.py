from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.expenses.models import Expense
from splex.expenses.services import ensure_context_access, soft_delete_expense
from splex.expenses.services_update import update_expense
from splex.groups.api.serializers import ExpenseCreateSerializer
from splex.ledger.serializers import serialize_expense


class ExpenseDetailView(APIView):
    def get(self, request, expense_id):
        expense = Expense.objects.prefetch_related("payment_shares", "owed_shares").get(
            id=expense_id
        )
        ensure_context_access(request.user, expense.group, expense.friendship)
        return Response(serialize_expense(expense))

    def patch(self, request, expense_id):
        expense = Expense.objects.prefetch_related("payment_shares", "owed_shares").get(
            id=expense_id, deleted_at__isnull=True
        )
        serializer = ExpenseCreateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        expense = update_expense(
            actor=request.user, expense=expense, data=serializer.validated_data
        )
        expense = Expense.objects.prefetch_related("payment_shares", "owed_shares").get(
            id=expense.id
        )
        return Response(serialize_expense(expense))

    def delete(self, request, expense_id):
        expense = Expense.objects.get(id=expense_id, deleted_at__isnull=True)
        soft_delete_expense(actor=request.user, expense=expense)
        return Response(status=status.HTTP_204_NO_CONTENT)

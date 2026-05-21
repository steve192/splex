from decimal import Decimal

from django.db.models import Q
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


class LocationSuggestionsView(APIView):
    def get(self, request):
        latitude = request.query_params.get("latitude")
        longitude = request.query_params.get("longitude")
        radius = request.query_params.get("radius", 100)

        if not latitude or not longitude:
            return Response(
                {"error": "latitude and longitude are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            latitude = Decimal(latitude)
            longitude = Decimal(longitude)
            radius = float(radius)
        except (ValueError, TypeError):
            return Response(
                {"error": "Invalid latitude, longitude, or radius"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Simple bounding box query (good approximation for small radii)
        # 0.009 degrees ≈ 1 km at equator
        lat_delta = Decimal(str(radius / 111000))  # ~111 km per degree
        lon_delta = Decimal(str(radius / (111000 * 1)))  # Simplified, doesn't account for latitude

        expenses = Expense.objects.filter(
            Q(deleted_at__isnull=True) & Q(created_by=request.user) &
            Q(latitude__isnull=False) & Q(longitude__isnull=False) &
            Q(latitude__gte=latitude - lat_delta) &
            Q(latitude__lte=latitude + lat_delta) &
            Q(longitude__gte=longitude - lon_delta) &
            Q(longitude__lte=longitude + lon_delta)
        ).values_list("description", flat=True).distinct().order_by("-id")[:10]

        return Response({"suggestions": list(expenses)})

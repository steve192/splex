from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.expenses.services import ensure_context_access
from splex.groups.api.serializers import SettlementCreateSerializer
from splex.ledger.serializers import serialize_settlement
from splex.settlements.models import Settlement
from splex.settlements.services import soft_delete_settlement, update_settlement


class SettlementDetailView(APIView):
    def get(self, request, settlement_id):
        settlement = Settlement.objects.select_related(
            "payer_participant__user", "receiver_participant__user"
        ).get(id=settlement_id)
        ensure_context_access(request.user, settlement.group, settlement.friendship)
        return Response(serialize_settlement(settlement))

    def delete(self, request, settlement_id):
        settlement = Settlement.objects.get(id=settlement_id, deleted_at__isnull=True)
        soft_delete_settlement(actor=request.user, settlement=settlement)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def patch(self, request, settlement_id):
        settlement = Settlement.objects.get(id=settlement_id, deleted_at__isnull=True)
        serializer = SettlementCreateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        settlement = update_settlement(
            actor=request.user,
            settlement=settlement,
            data=serializer.validated_data,
        )
        settlement = Settlement.objects.select_related(
            "payer_participant__user", "receiver_participant__user"
        ).get(id=settlement.id)
        return Response(serialize_settlement(settlement))

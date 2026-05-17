from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.expenses.models import Expense
from splex.expenses.services import create_expense
from splex.friends.models import Friendship
from splex.groups.api.views import serialize_expense
from splex.groups.models import Group
from splex.sync.models import ClientMutation


class SyncMutationsView(APIView):
    @transaction.atomic
    def post(self, request):
        client_mutation_id = request.data["clientMutationId"]
        mutation_type = request.data["type"]
        payload = request.data.get("payload", {})
        mutation, created = ClientMutation.objects.get_or_create(
            user=request.user,
            client_mutation_id=client_mutation_id,
            defaults={
                "mutation_type": mutation_type,
                "request_payload": payload,
            },
        )
        if not created and mutation.status == ClientMutation.Status.PROCESSED:
            return Response(mutation.response_payload)
        if mutation_type != "create_expense":
            mutation.status = ClientMutation.Status.FAILED
            mutation.error = "Only create_expense mutations are supported."
            mutation.save(update_fields=["status", "error"])
            return Response({"detail": mutation.error}, status=status.HTTP_400_BAD_REQUEST)
        try:
            context_type = payload["context_type"]
            if context_type == "group":
                expense = create_expense(
                    actor=request.user,
                    group=Group.objects.get(id=payload["context_id"]),
                    data=payload["expense"],
                )
            elif context_type == "friendship":
                expense = create_expense(
                    actor=request.user,
                    friendship=Friendship.objects.get(id=payload["context_id"]),
                    data=payload["expense"],
                )
            else:
                raise ValueError("Unsupported expense context.")
            expense = Expense.objects.prefetch_related("payment_shares", "owed_shares").get(
                id=expense.id
            )
            response_payload = {
                "clientMutationId": client_mutation_id,
                "type": mutation_type,
                "expense": serialize_expense(expense),
            }
            mutation.response_payload = response_payload
            mutation.status = ClientMutation.Status.PROCESSED
            mutation.processed_at = timezone.now()
            mutation.save(update_fields=["response_payload", "status", "processed_at"])
            return Response(response_payload, status=status.HTTP_201_CREATED)
        except Exception as exc:
            mutation.status = ClientMutation.Status.FAILED
            mutation.error = str(exc)
            mutation.save(update_fields=["status", "error"])
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

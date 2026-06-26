import json
import logging

from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.expenses.models import Expense
from splex.expenses.services import create_expense
from splex.friends.models import Friendship
from splex.groups.models import Group
from splex.ledger.serializers import serialize_expense
from splex.shared.errors import DomainError, ErrorCode
from splex.sync.models import ClientMutation

SYNC_MUTATION_FAILURE_MESSAGE = "The pending expense could not be synchronized."

logger = logging.getLogger("splex.sync")


def to_json_value(value):
    return json.loads(json.dumps(value, cls=DjangoJSONEncoder))


class SyncMutationsView(APIView):
    def post(self, request):
        mutation = None
        try:
            client_mutation_id = request.data.get("clientMutationId")
            mutation_type = request.data.get("type")
            payload = request.data.get("payload", {})

            if not client_mutation_id:
                raise DomainError(
                    ErrorCode.SYNC_MUTATION_INVALID,
                    "clientMutationId is required.",
                )
            if not mutation_type:
                raise DomainError(ErrorCode.SYNC_MUTATION_INVALID, "type is required.")

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
                raise DomainError(
                    ErrorCode.SYNC_MUTATION_UNSUPPORTED,
                    mutation.error,
                )

            with transaction.atomic():
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
                    raise DomainError(
                        ErrorCode.SYNC_MUTATION_INVALID,
                        "Unsupported expense context.",
                    )
                expense = Expense.objects.prefetch_related(
                    "payment_shares",
                    "owed_shares",
                    "receipts",
                ).get(id=expense.id)
                response_payload = {
                    "clientMutationId": client_mutation_id,
                    "type": mutation_type,
                    "expense": serialize_expense(expense),
                }
                mutation.response_payload = to_json_value(response_payload)
                mutation.status = ClientMutation.Status.PROCESSED
                mutation.processed_at = timezone.now()
                mutation.save(update_fields=["response_payload", "status", "processed_at"])
            return Response(response_payload, status=status.HTTP_201_CREATED)
        except DomainError:
            if mutation is not None:
                ClientMutation.objects.filter(pk=mutation.pk).update(
                    status=ClientMutation.Status.FAILED,
                    error=SYNC_MUTATION_FAILURE_MESSAGE,
                )
            raise
        except Exception:
            logger.exception(
                "sync mutation failed",
                extra={
                    "user_id": getattr(request.user, "id", None),
                    "client_mutation_id": request.data.get("clientMutationId"),
                    "mutation_type": request.data.get("type"),
                },
            )
            if mutation is not None:
                ClientMutation.objects.filter(pk=mutation.pk).update(
                    status=ClientMutation.Status.FAILED,
                    error=SYNC_MUTATION_FAILURE_MESSAGE,
                )
            raise

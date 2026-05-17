import logging

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.invitations.models import Invitation
from splex.invitations.services import accept_invitation

logger = logging.getLogger(__name__)


class InvitationPreviewView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        logger.info("Invitation preview requested token_prefix=%s", token[:6])
        try:
            invitation = Invitation.objects.select_related("group", "target_participant").get(
                token_hash=Invitation.hash_token(token)
            )
        except Invitation.DoesNotExist:
            logger.info("Invitation preview failed token_prefix=%s reason=not_found", token[:6])
            return Response({"detail": "Invitation not found."}, status=status.HTTP_404_NOT_FOUND)
        logger.info(
            "Invitation preview resolved token_prefix=%s invitation_id=%s type=%s valid=%s",
            token[:6],
            invitation.id,
            invitation.type,
            invitation.is_valid(),
        )
        return Response(
            {
                "type": invitation.type,
                "valid": invitation.is_valid(),
                "group": invitation.group.name if invitation.group else None,
                "target_participant": (
                    invitation.target_participant.display_name
                    if invitation.target_participant
                    else None
                ),
            }
        )


class InvitationAcceptView(APIView):
    def post(self, request, token):
        logger.info(
            "Invitation accept requested token_prefix=%s user_id=%s authenticated=%s",
            token[:6],
            getattr(request.user, "id", None),
            request.user.is_authenticated,
        )
        try:
            invitation = accept_invitation(actor=request.user, token=token)
        except (Invitation.DoesNotExist, ValueError) as exc:
            logger.info(
                "Invitation accept failed token_prefix=%s user_id=%s reason=%s",
                token[:6],
                getattr(request.user, "id", None),
                exc,
            )
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        logger.info(
            "Invitation accept succeeded token_prefix=%s invitation_id=%s user_id=%s",
            token[:6],
            invitation.id,
            getattr(request.user, "id", None),
        )
        return Response({"id": invitation.id, "type": invitation.type})

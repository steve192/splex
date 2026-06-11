import logging
import mimetypes

from django.conf import settings
from django.core.files.storage import default_storage
from django.http import FileResponse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.invitations.models import Invitation
from splex.invitations.services import accept_invitation
from splex.shared.media import media_storage_path

logger = logging.getLogger(__name__)


def invitation_by_token(token: str):
    return Invitation.objects.select_related("group", "target_participant", "invited_by").get(
        token_hash=Invitation.hash_token(token)
    )


def invitation_image_url(token: str, kind: str, image_url: str) -> str:
    if not image_url:
        return ""
    return f"{settings.BACKEND_PUBLIC_URL}/api/invitations/{token}/images/{kind}/"


def storage_path_from_media_url(url: str) -> str:
    return media_storage_path(url)


class InvitationPreviewView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "invitation_preview"

    def get(self, request, token):
        logger.info("Invitation preview requested token_prefix=%s", token[:6])
        try:
            invitation = invitation_by_token(token)
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
                "group_image_url": (
                    invitation_image_url(token, "group", invitation.group.icon_url)
                    if invitation.group
                    else ""
                ),
                "invited_by": invitation.invited_by.display_name or invitation.invited_by.email,
                "invited_by_image_url": invitation_image_url(
                    token, "inviter", invitation.invited_by.avatar_url
                ),
                "target_participant": (
                    invitation.target_participant.effective_display_name
                    if invitation.target_participant
                    else None
                ),
            }
        )


class InvitationImageView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "private_media"
    IMAGE_NOT_FOUND_DETAIL = "Image not found."

    def get(self, request, token, kind):
        try:
            invitation = invitation_by_token(token)
        except Invitation.DoesNotExist:
            return Response({"detail": "Invitation not found."}, status=status.HTTP_404_NOT_FOUND)
        if not invitation.is_valid():
            return Response({"detail": "Invitation is expired."}, status=status.HTTP_404_NOT_FOUND)
        if kind == "inviter":
            image_url = invitation.invited_by.avatar_url
        elif kind == "group" and invitation.group:
            image_url = invitation.group.icon_url
        else:
            return Response(
                {"detail": self.IMAGE_NOT_FOUND_DETAIL}, status=status.HTTP_404_NOT_FOUND
            )
        if not image_url:
            return Response(
                {"detail": self.IMAGE_NOT_FOUND_DETAIL}, status=status.HTTP_404_NOT_FOUND
            )
        try:
            path = storage_path_from_media_url(image_url)
        except ValueError:
            return Response(
                {"detail": self.IMAGE_NOT_FOUND_DETAIL}, status=status.HTTP_404_NOT_FOUND
            )
        if not default_storage.exists(path):
            return Response(
                {"detail": self.IMAGE_NOT_FOUND_DETAIL}, status=status.HTTP_404_NOT_FOUND
            )
        content_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
        return FileResponse(default_storage.open(path, "rb"), content_type=content_type)


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

from django.contrib.auth import get_user_model
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.groups.models import Group
from splex.shared.media import private_media_response, storage_path_from_signed_token
from splex.shared.open_source import build_open_source_payload


class PrivateMediaView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "private_media"

    def get(self, request, token):
        return private_media_response(storage_path_from_signed_token(token))


class MediaAttributionView(APIView):
    """Returns the stored attribution string for an image. Avatars and group
    icons store an optional attribution (e.g. CC license text from Openverse)
    on the owning User/Group; this endpoint exposes it for the popup that
    enlarges any avatar without forcing every list/detail endpoint to inline
    the field next to its avatar URL."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "private_media"

    def get(self, request, token):
        try:
            path = storage_path_from_signed_token(token)
        except Exception:
            return Response({"attribution": ""})
        attribution = ""
        if path.startswith("profile-images/"):
            user = (
                get_user_model()
                .objects.filter(avatar_url=path)
                .only("avatar_attribution")
                .first()
            )
            if user:
                attribution = user.avatar_attribution or ""
        elif path.startswith("group-icons/"):
            group = Group.objects.filter(icon_url=path).only("icon_attribution").first()
            if group:
                attribution = group.icon_attribution or ""
        return Response({"attribution": attribution})


class OpenSourceComponentsView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(build_open_source_payload())

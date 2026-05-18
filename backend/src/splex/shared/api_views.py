from rest_framework import permissions
from rest_framework.views import APIView

from splex.shared.media import private_media_response, storage_path_from_signed_token


class PrivateMediaView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "private_media"

    def get(self, request, token):
        return private_media_response(storage_path_from_signed_token(token))

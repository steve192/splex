from rest_framework import permissions, status
from rest_framework.renderers import StaticHTMLRenderer
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from splex.accounts.api.serializers import (
    MagicCodeVerifySerializer,
    MagicLinkRequestSerializer,
    MagicTokenVerifySerializer,
    UserSerializer,
    UserUpdateSerializer,
)
from splex.accounts.services import (
    authenticate_magic_code,
    authenticate_magic_token,
    authenticate_with_google,
    delete_account,
    request_magic_login,
)
from splex.shared.tos import render_legal_document
from splex.shared.uploads import save_data_url_image


class LoginConfigView(APIView):
    """Public endpoint - returns login screen configuration and app-level feature flags."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.conf import settings

        return Response(
            {
                "google": {
                    "client_id": settings.GOOGLE_CLIENT_ID or None,
                    "android_client_id": settings.GOOGLE_ANDROID_CLIENT_ID or None,
                },
                "demo_mode_enabled": bool(getattr(settings, "DEMO_MODE_ENABLED", False)),
                "map_tile_url": getattr(
                    settings,
                    "MAP_TILE_URL",
                    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                )
            }
        )


class GoogleAuthView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        id_token = request.data.get("id_token", "")
        if not id_token:
            return Response({"detail": "id_token is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user, tokens = authenticate_with_google(id_token=id_token)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"user": UserSerializer(user).data, "tokens": tokens})


class MagicLinkRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "magic_link"

    def post(self, request):
        serializer = MagicLinkRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_magic_login(
            serializer.validated_data["email"],
            invite_token=serializer.validated_data.get("invite_token", ""),
        )
        return Response({"status": "sent"})


class MagicCodeVerifyView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "magic_code"

    def post(self, request):
        serializer = MagicCodeVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user, tokens = authenticate_magic_code(**serializer.validated_data)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"user": UserSerializer(user).data, "tokens": tokens})


class MagicTokenVerifyView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "magic_token"

    def post(self, request):
        serializer = MagicTokenVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user, tokens = authenticate_magic_token(serializer.validated_data["token"])
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"user": UserSerializer(user).data, "tokens": tokens})


class _LegalDocumentView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    renderer_classes = [StaticHTMLRenderer]
    document_kind: str = ""

    def get(self, request):
        return Response(
            render_legal_document(self.document_kind),
            content_type="text/html; charset=utf-8",
        )


class TermsOfServiceView(_LegalDocumentView):
    document_kind = "tos"


class PrivacyPolicyView(_LegalDocumentView):
    document_kind = "privacy"


class ImprintView(_LegalDocumentView):
    document_kind = "imprint"


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        data = serializer.validated_data
        update_fields: list[str] = []
        if "avatar_image" in data and data["avatar_image"]:
            user.avatar_url = save_data_url_image(data_url=data["avatar_image"], folder="profile-images")
            # New image always replaces previous attribution.
            user.avatar_attribution = data.get("avatar_attribution") or ""
            update_fields.extend(["avatar_url", "avatar_attribution"])
        elif "avatar_attribution" in data:
            user.avatar_attribution = data["avatar_attribution"] or ""
            update_fields.append("avatar_attribution")
        for field, value in data.items():
            if field in {"avatar_image", "avatar_attribution"}:
                continue
            if field == "default_currency":
                value = value.upper()
            setattr(user, field, value)
            update_fields.append(field)
        user.save(update_fields=update_fields)
        return Response(UserSerializer(user).data)


class MeDeleteView(APIView):
    def delete(self, request):
        delete_account(actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class LogoutView(APIView):
    def post(self, request):
        refresh = request.data.get("refresh")
        if refresh:
            RefreshToken(refresh).blacklist()
        return Response(status=status.HTTP_204_NO_CONTENT)

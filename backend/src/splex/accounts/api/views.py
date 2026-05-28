import base64
import json
import logging
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.renderers import StaticHTMLRenderer
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

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

logger = logging.getLogger(__name__)

# Only write last_login once per this interval to avoid a DB update on every refresh call.
_LAST_LOGIN_UPDATE_INTERVAL = timedelta(hours=24)


def _user_id_from_jwt_payload(token_str: str):
    """Extract user_id from a JWT without signature validation (read-only)."""
    try:
        payload_b64 = token_str.split(".")[1]
        # Restore padding
        payload_b64 += "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.b64decode(payload_b64))
        return payload.get("user_id")
    except Exception:
        return None


class UpdateLastLoginTokenRefreshView(TokenRefreshView):
    """Wraps simplejwt's TokenRefreshView to keep last_login current.

    simplejwt's UPDATE_LAST_LOGIN setting only applies to the obtain-pair view.
    Since Splex issues tokens via custom login flows, token refresh is the only
    long-running signal that a user is still active.  We update last_login at
    most once per 24 hours to avoid a DB write on every refresh call.
    """

    def post(self, request, *args, **kwargs):
        # Read user_id from the incoming refresh token before it is rotated/blacklisted.
        user_id = _user_id_from_jwt_payload(request.data.get("refresh", ""))
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200 and user_id:
            try:
                user_model = get_user_model()
                cutoff = timezone.now() - _LAST_LOGIN_UPDATE_INTERVAL
                # Only update if last_login is stale (or never set), to keep DB writes minimal.
                updated = user_model.objects.filter(pk=user_id).filter(
                    Q(last_login__lt=cutoff) | Q(last_login__isnull=True)
                ).update(last_login=timezone.now())
                if updated:
                    logger.debug("Updated last_login via token refresh for user_id=%s", user_id)
            except Exception:
                logger.warning("Failed to update last_login on token refresh", exc_info=True)
        return response


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
                "risky_imports_enabled": bool(
                    getattr(settings, "ENABLE_RISKY_IMPORTS", False)
                ),
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

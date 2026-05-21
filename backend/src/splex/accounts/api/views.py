from rest_framework import permissions, status
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
from splex.shared.uploads import save_data_url_image


class AuthProvidersView(APIView):
    """Public endpoint — returns which optional login methods are configured."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.conf import settings

        return Response(
            {
                "google": {
                    "client_id": settings.GOOGLE_CLIENT_ID or None,
                    "android_client_id": settings.GOOGLE_ANDROID_CLIENT_ID or None,
                }
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


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        for field, value in serializer.validated_data.items():
            if field == "avatar_image":
                user.avatar_url = save_data_url_image(data_url=value, folder="profile-images")
                continue
            if field == "default_currency":
                value = value.upper()
            setattr(user, field, value)
        update_fields = [
            "avatar_url" if field == "avatar_image" else field
            for field in serializer.validated_data.keys()
        ]
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

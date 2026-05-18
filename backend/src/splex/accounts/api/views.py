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
    request_magic_login,
)
from splex.shared.uploads import save_data_url_image


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
        if "display_name" in serializer.validated_data and hasattr(user, "participant"):
            user.participant.display_name = user.display_name or user.email.split("@")[0]
            user.participant.save(update_fields=["display_name", "updated_at"])
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    def post(self, request):
        refresh = request.data.get("refresh")
        if refresh:
            RefreshToken(refresh).blacklist()
        return Response(status=status.HTTP_204_NO_CONTENT)

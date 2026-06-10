from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.notifications.models import DeviceToken, WebPushSubscription
from splex.notifications.services import get_active_vapid_key


class DeviceTokenSerializer(serializers.Serializer):
    token = serializers.CharField()
    platform = serializers.ChoiceField(
        choices=DeviceToken.Platform.choices,
        default=DeviceToken.Platform.ANDROID,
    )
    enabled = serializers.BooleanField(default=True)


class _WebPushKeysSerializer(serializers.Serializer):
    p256dh = serializers.CharField()
    auth = serializers.CharField()


class WebPushSubscriptionSerializer(serializers.Serializer):
    endpoint = serializers.CharField()
    keys = _WebPushKeysSerializer()
    enabled = serializers.BooleanField(default=True)


class NotificationConfigView(APIView):
    def get(self, request):
        return Response(
            {
                "vapid_public_key": get_active_vapid_key().public_key,
                "push_enabled": request.user.push_enabled,
            }
        )


class DeviceTokenView(APIView):
    def post(self, request):
        serializer = DeviceTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # Keyed on the token alone: a device belongs to exactly one account, so
        # registering it under a new user takes it away from the previous one.
        # Otherwise the previous account would keep receiving this device's
        # notifications after someone else logged in on it.
        DeviceToken.objects.update_or_create(
            token=data["token"],
            defaults={
                "user": request.user,
                "platform": data["platform"],
                "enabled": data["enabled"],
            },
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class WebPushSubscriptionView(APIView):
    def post(self, request):
        serializer = WebPushSubscriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        # Keyed on the endpoint alone - same ownership-move semantics as
        # DeviceTokenView above.
        WebPushSubscription.objects.update_or_create(
            endpoint=data["endpoint"],
            defaults={
                "user": request.user,
                "p256dh": data["keys"]["p256dh"],
                "auth": data["keys"]["auth"],
                "enabled": data["enabled"],
            },
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

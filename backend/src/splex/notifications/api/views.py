from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.notifications.models import DeviceToken, WebPushSubscription
from splex.notifications.services import get_active_vapid_key


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
        token = request.data["token"]
        platform = request.data.get("platform", DeviceToken.Platform.ANDROID)
        enabled = bool(request.data.get("enabled", True))
        DeviceToken.objects.update_or_create(
            user=request.user,
            token=token,
            defaults={"platform": platform, "enabled": enabled},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class WebPushSubscriptionView(APIView):
    def post(self, request):
        enabled = bool(request.data.get("enabled", True))
        WebPushSubscription.objects.update_or_create(
            user=request.user,
            endpoint=request.data["endpoint"],
            defaults={
                "p256dh": request.data["keys"]["p256dh"],
                "auth": request.data["keys"]["auth"],
                "enabled": enabled,
            },
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

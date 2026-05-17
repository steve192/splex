from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.notifications.models import DeviceToken, WebPushSubscription


class NotificationConfigView(APIView):
    def get(self, request):
        return Response(
            {
                "vapid_public_key": settings.VAPID_PUBLIC_KEY,
                "push_enabled": request.user.push_enabled,
            }
        )


class DeviceTokenView(APIView):
    def post(self, request):
        token = request.data["token"]
        platform = request.data.get("platform", DeviceToken.Platform.ANDROID)
        DeviceToken.objects.update_or_create(
            user=request.user,
            token=token,
            defaults={"platform": platform, "enabled": True},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class WebPushSubscriptionView(APIView):
    def post(self, request):
        WebPushSubscription.objects.update_or_create(
            user=request.user,
            endpoint=request.data["endpoint"],
            defaults={
                "p256dh": request.data["keys"]["p256dh"],
                "auth": request.data["keys"]["auth"],
                "enabled": True,
            },
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

from django.urls import path

from splex.notifications.api.views import (
    DeviceTokenView,
    NotificationConfigView,
    WebPushSubscriptionView,
)

urlpatterns = [
    path("notifications/config/", NotificationConfigView.as_view()),
    path("notifications/device-tokens/", DeviceTokenView.as_view()),
    path("notifications/web-push-subscriptions/", WebPushSubscriptionView.as_view()),
]

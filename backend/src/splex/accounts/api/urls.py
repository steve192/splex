from django.urls import path

from splex.accounts.api.views import (
    LogoutView,
    MagicCodeVerifyView,
    MagicLinkRequestView,
    MagicTokenVerifyView,
    MeView,
)

urlpatterns = [
    path("auth/magic-link/", MagicLinkRequestView.as_view()),
    path("auth/magic-code/", MagicCodeVerifyView.as_view()),
    path("auth/magic-token/", MagicTokenVerifyView.as_view()),
    path("auth/logout/", LogoutView.as_view()),
    path("me/", MeView.as_view()),
]


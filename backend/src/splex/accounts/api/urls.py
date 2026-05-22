from django.urls import path

from splex.accounts.api.views import (
    GoogleAuthView,
    LoginConfigView,
    LogoutView,
    MagicCodeVerifyView,
    MagicLinkRequestView,
    MagicTokenVerifyView,
    MeDeleteView,
    MeView,
    TermsOfServiceView,
)

urlpatterns = [
    path("login/config/", LoginConfigView.as_view()),
    path("auth/google/", GoogleAuthView.as_view()),
    path("auth/magic-link/", MagicLinkRequestView.as_view()),
    path("auth/magic-code/", MagicCodeVerifyView.as_view()),
    path("auth/magic-token/", MagicTokenVerifyView.as_view()),
    path("auth/logout/", LogoutView.as_view()),
    path("tos/", TermsOfServiceView.as_view()),
    path("me/", MeView.as_view()),
    path("me/delete/", MeDeleteView.as_view()),
]


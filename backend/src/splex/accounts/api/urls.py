from django.urls import path

from splex.accounts.api.views import (
    GoogleAuthView,
    ImprintView,
    LoginConfigView,
    LogoutView,
    MagicCodeVerifyView,
    MagicLinkRequestView,
    MagicTokenVerifyView,
    MeDeleteView,
    MeView,
    ParticipantPreferredPaymentView,
    PaymentMethodDetailView,
    PaymentMethodListCreateView,
    PrivacyPolicyView,
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
    path("privacy/", PrivacyPolicyView.as_view()),
    path("imprint/", ImprintView.as_view()),
    path("me/", MeView.as_view()),
    path("me/delete/", MeDeleteView.as_view()),
    path("me/payment-methods/", PaymentMethodListCreateView.as_view()),
    path(
        "me/payment-methods/<int:payment_method_id>/",
        PaymentMethodDetailView.as_view(),
    ),
    path(
        "participants/<int:participant_id>/preferred-payment-method/",
        ParticipantPreferredPaymentView.as_view(),
    ),
]


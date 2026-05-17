from django.urls import path

from splex.invitations.api.views import (
    InvitationAcceptView,
    InvitationImageView,
    InvitationPreviewView,
)

urlpatterns = [
    path("invitations/<str:token>/", InvitationPreviewView.as_view()),
    path("invitations/<str:token>/images/<str:kind>/", InvitationImageView.as_view()),
    path("invitations/<str:token>/accept/", InvitationAcceptView.as_view()),
]

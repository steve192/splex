from django.urls import path

from splex.invitations.api.views import InvitationAcceptView, InvitationPreviewView

urlpatterns = [
    path("invitations/<str:token>/", InvitationPreviewView.as_view()),
    path("invitations/<str:token>/accept/", InvitationAcceptView.as_view()),
]


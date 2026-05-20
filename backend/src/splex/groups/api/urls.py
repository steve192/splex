from django.urls import path

from splex.groups.api.views import (
    GroupBalancesView,
    GroupDetailView,
    GroupExpensesView,
    GroupInvitationsView,
    GroupLedgerView,
    GroupListCreateView,
    GroupParticipantDetailView,
    GroupParticipantOutstandingView,
    GroupParticipantsView,
    GroupSettlementsView,
    OverviewView,
)

urlpatterns = [
    path("overview/", OverviewView.as_view()),
    path("groups/", GroupListCreateView.as_view()),
    path("groups/<int:group_id>/", GroupDetailView.as_view()),
    path("groups/<int:group_id>/participants/", GroupParticipantsView.as_view()),
    path(
        "groups/<int:group_id>/participants/<int:participant_id>/",
        GroupParticipantDetailView.as_view(),
    ),
    path(
        "groups/<int:group_id>/participants/<int:participant_id>/outstanding/",
        GroupParticipantOutstandingView.as_view(),
    ),
    path("groups/<int:group_id>/balances/", GroupBalancesView.as_view()),
    path("groups/<int:group_id>/ledger/", GroupLedgerView.as_view()),
    path("groups/<int:group_id>/expenses/", GroupExpensesView.as_view()),
    path("groups/<int:group_id>/settlements/", GroupSettlementsView.as_view()),
    path("groups/<int:group_id>/invitations/", GroupInvitationsView.as_view()),
]

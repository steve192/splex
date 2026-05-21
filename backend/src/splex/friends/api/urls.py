from django.urls import path

from splex.friends.api.views import (
    FriendDetailView,
    FriendExpensesView,
    FriendInvitationsView,
    FriendLedgerView,
    FriendListView,
    FriendSettlementsView,
    FriendStatisticsView,
)

urlpatterns = [
    path("friends/", FriendListView.as_view()),
    path("friends/invitations/", FriendInvitationsView.as_view()),
    path("friends/<int:friendship_id>/", FriendDetailView.as_view()),
    path("friends/<int:friendship_id>/ledger/", FriendLedgerView.as_view()),
    path("friends/<int:friendship_id>/expenses/", FriendExpensesView.as_view()),
    path("friends/<int:friendship_id>/settlements/", FriendSettlementsView.as_view()),
    path("friends/<int:friendship_id>/statistics/", FriendStatisticsView.as_view()),
]

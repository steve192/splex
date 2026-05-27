from django.urls import path

from splex.imports.api.views import (
    SplitProImportView,
    SplitProListUsersView,
    SplitwiseImportView,
)

urlpatterns = [
    path("imports/splitwise/", SplitwiseImportView.as_view()),
    path("imports/split-pro/users/", SplitProListUsersView.as_view()),
    path("imports/split-pro/", SplitProImportView.as_view()),
]

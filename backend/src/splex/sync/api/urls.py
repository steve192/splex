from django.urls import path

from splex.sync.api.views import SyncMutationsView

urlpatterns = [path("sync/mutations/", SyncMutationsView.as_view())]


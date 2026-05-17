from django.urls import path

from splex.activity.api.views import ActivityListView

urlpatterns = [path("activity/", ActivityListView.as_view())]


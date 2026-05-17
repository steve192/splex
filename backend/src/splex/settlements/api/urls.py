from django.urls import path

from splex.settlements.api.views import SettlementDetailView

urlpatterns = [path("settlements/<int:settlement_id>/", SettlementDetailView.as_view())]


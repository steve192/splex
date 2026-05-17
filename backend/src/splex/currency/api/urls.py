from django.urls import path

from splex.currency.api.views import CurrencyRatesView

urlpatterns = [path("currency/rates/", CurrencyRatesView.as_view())]


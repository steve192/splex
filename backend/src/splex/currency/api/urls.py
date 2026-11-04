from django.urls import path

from splex.currency.api.views import CurrencyRatesView, CurrencyRateView

urlpatterns = [
    path("currency/rates/", CurrencyRatesView.as_view()),
    path("currency/rate/", CurrencyRateView.as_view()),
]


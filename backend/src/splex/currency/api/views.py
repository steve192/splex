from rest_framework.response import Response
from rest_framework.views import APIView

from splex.currency.models import ExchangeRate


class CurrencyRatesView(APIView):
    def get(self, request):
        rates = ExchangeRate.objects.all()[:100]
        return Response(
            [
                {
                    "base_currency": rate.base_currency,
                    "quote_currency": rate.quote_currency,
                    "rate": str(rate.rate),
                    "source": rate.source,
                    "fetched_at": rate.fetched_at,
                }
                for rate in rates
            ]
        )


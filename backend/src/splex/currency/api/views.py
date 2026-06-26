from rest_framework.response import Response
from rest_framework.views import APIView

from splex.currency.services import get_latest_rates_snapshot


class CurrencyRatesView(APIView):
    def get(self, request):
        snapshot = get_latest_rates_snapshot()
        return Response(
            {
                "base_currency": snapshot.base_currency,
                "rates": snapshot.rates,
                "source": snapshot.source,
                "fetched_at": snapshot.fetched_at.isoformat(),
            }
        )

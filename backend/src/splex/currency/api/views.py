from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from splex.currency.api.serializers import CurrencyRateQuerySerializer
from splex.currency.services import get_latest_rates_snapshot, get_rate_for_date


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


class CurrencyRateView(APIView):
    """The official rate the backend uses for an expense on the given date (default: today)."""

    def get(self, request):
        query = CurrencyRateQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        rate = get_rate_for_date(
            query.validated_data["base_currency"],
            query.validated_data["quote_currency"],
            query.validated_data.get("date") or timezone.localdate(),
        )
        return Response(
            {
                "base_currency": rate.base_currency,
                "quote_currency": rate.quote_currency,
                "rate": str(rate.rate),
                "rate_date": rate.rate_date,
                "source": rate.source,
            }
        )

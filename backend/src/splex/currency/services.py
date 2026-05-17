from decimal import Decimal

from django.conf import settings
from django.utils import timezone

from splex.currency.models import ExchangeRate
from splex.shared.money import money


def get_latest_rate(base_currency: str, quote_currency: str) -> ExchangeRate:
    base_currency = base_currency.upper()
    quote_currency = quote_currency.upper()
    if base_currency == quote_currency:
        return ExchangeRate(
            base_currency=base_currency,
            quote_currency=quote_currency,
            rate=Decimal("1"),
            source="identity",
            fetched_at=timezone.now(),
        )
    cached = (
        ExchangeRate.objects.filter(base_currency=base_currency, quote_currency=quote_currency)
        .order_by("-fetched_at")
        .first()
    )
    if cached:
        return cached
    if settings.CURRENCY_RATE_PROVIDER == "placeholder":
        raise ValueError("Currency conversion provider is not configured.")
    raise ValueError(f"Unsupported currency provider: {settings.CURRENCY_RATE_PROVIDER}")


def convert(amount, base_currency: str, quote_currency: str):
    rate = get_latest_rate(base_currency, quote_currency)
    converted = money(money(amount) * rate.rate)
    return converted, rate


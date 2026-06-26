from decimal import Decimal

import requests
from django.conf import settings
from django.utils import timezone

from splex.currency.models import ExchangeRate
from splex.shared.errors import DomainError, ErrorCode
from splex.shared.money import money


def fetch_frankfurter_rate(base_currency: str, quote_currency: str) -> ExchangeRate:
    api_base_url = (settings.CURRENCY_RATE_API_BASE_URL or "https://api.frankfurter.dev").rstrip("/")
    response = requests.get(
        f"{api_base_url}/v2/rate/{base_currency}/{quote_currency}",
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    rate = Decimal(str(payload["rate"]))
    return ExchangeRate.objects.create(
        base_currency=base_currency,
        quote_currency=quote_currency,
        rate=rate,
        source="frankfurter",
    )


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
    if cached and cached.fetched_at.date() == timezone.localdate():
        return cached
    if settings.CURRENCY_RATE_PROVIDER == "frankfurter":
        try:
            return fetch_frankfurter_rate(base_currency, quote_currency)
        except (KeyError, requests.RequestException, ValueError) as exc:
            if cached:
                return cached
            raise DomainError(
                ErrorCode.CURRENCY_RATE_UNAVAILABLE,
                "Currency conversion rate could not be fetched.",
            ) from exc
    if settings.CURRENCY_RATE_PROVIDER == "placeholder":
        if cached:
            return cached
        raise DomainError(
            ErrorCode.CURRENCY_RATE_UNAVAILABLE,
            "Currency conversion provider is not configured.",
        )
    raise DomainError(
        ErrorCode.CURRENCY_RATE_UNAVAILABLE,
        f"Unsupported currency provider: {settings.CURRENCY_RATE_PROVIDER}",
    )


def convert(amount, base_currency: str, quote_currency: str):
    rate = get_latest_rate(base_currency, quote_currency)
    converted = money(money(amount) * rate.rate)
    return converted, rate

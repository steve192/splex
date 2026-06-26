from decimal import Decimal

import requests
from django.conf import settings
from django.utils import timezone

from splex.currency.constants import CURRENCY_SNAPSHOT_BASE, SUPPORTED_CURRENCIES
from splex.currency.models import CurrencyRateSnapshot, ExchangeRate
from splex.shared.errors import DomainError, ErrorCode
from splex.shared.money import money


def currency_rate_api_base_url() -> str:
    return (settings.CURRENCY_RATE_API_BASE_URL or "https://api.frankfurter.dev").rstrip("/")


def fetch_frankfurter_rate(base_currency: str, quote_currency: str) -> ExchangeRate:
    response = requests.get(
        f"{currency_rate_api_base_url()}/v2/rate/{base_currency}/{quote_currency}",
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


def fetch_frankfurter_rates_snapshot() -> CurrencyRateSnapshot:
    response = requests.get(
        f"{currency_rate_api_base_url()}/v2/rates",
        params={"base": CURRENCY_SNAPSHOT_BASE},
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    rates = {CURRENCY_SNAPSHOT_BASE: "1"}
    for row in payload:
        if row["base"] != CURRENCY_SNAPSHOT_BASE:
            continue
        quote_currency = row["quote"].upper()
        if quote_currency in SUPPORTED_CURRENCIES:
            rates[quote_currency] = str(Decimal(str(row["rate"])))
    missing_currencies = set(SUPPORTED_CURRENCIES) - set(rates)
    if missing_currencies:
        missing_list = ", ".join(sorted(missing_currencies))
        raise ValueError(f"Currency rate snapshot is missing: {missing_list}")
    return CurrencyRateSnapshot.objects.create(
        base_currency=CURRENCY_SNAPSHOT_BASE,
        rates=rates,
        source="frankfurter",
    )


def has_complete_supported_rates(snapshot: CurrencyRateSnapshot) -> bool:
    return (
        snapshot.base_currency == CURRENCY_SNAPSHOT_BASE
        and set(SUPPORTED_CURRENCIES).issubset(snapshot.rates)
    )


def get_latest_rates_snapshot() -> CurrencyRateSnapshot:
    cached = CurrencyRateSnapshot.objects.first()
    if (
        cached
        and cached.fetched_at.date() == timezone.localdate()
        and has_complete_supported_rates(cached)
    ):
        return cached
    if settings.CURRENCY_RATE_PROVIDER == "frankfurter":
        try:
            return fetch_frankfurter_rates_snapshot()
        except (KeyError, requests.RequestException, ValueError) as exc:
            if cached:
                return cached
            raise DomainError(
                ErrorCode.CURRENCY_RATE_UNAVAILABLE,
                "Currency conversion rates could not be fetched.",
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

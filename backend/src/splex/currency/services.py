from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

import requests
from django.conf import settings
from django.utils import timezone

from splex.currency.constants import CURRENCY_SNAPSHOT_BASE, SUPPORTED_CURRENCIES
from splex.currency.models import CurrencyRateSnapshot
from splex.shared.errors import DomainError, ErrorCode
from splex.shared.money import money

RATE_PRECISION = Decimal("0.00000001")


@dataclass(frozen=True)
class CurrencyRate:
    base_currency: str
    quote_currency: str
    rate: Decimal
    source: str
    fetched_at: datetime
    # Date the provider rate represents. This can differ from an expense date
    # when historical lookup fails and we fall back to a nearby cached rate.
    rate_date: date | None


def currency_rate_api_base_url() -> str:
    return (settings.CURRENCY_RATE_API_BASE_URL or "https://api.frankfurter.dev").rstrip("/")


def _identity_rate(
    base_currency: str, quote_currency: str, rate_date: date | None = None
) -> CurrencyRate:
    return CurrencyRate(
        base_currency=base_currency,
        quote_currency=quote_currency,
        rate=Decimal("1"),
        source="identity",
        fetched_at=timezone.now(),
        rate_date=rate_date,
    )


def _normal_pair(base_currency: str, quote_currency: str) -> tuple[str, str]:
    return base_currency.upper(), quote_currency.upper()


def fetch_frankfurter_rates_snapshot(rate_date: date | None = None) -> CurrencyRateSnapshot:
    params = {"base": CURRENCY_SNAPSHOT_BASE}
    if rate_date is not None:
        params["date"] = rate_date.isoformat()
    response = requests.get(
        f"{currency_rate_api_base_url()}/v2/rates",
        params=params,
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
        rate_date=rate_date or timezone.localdate(),
        rates=rates,
        source="frankfurter",
    )


def has_complete_supported_rates(snapshot: CurrencyRateSnapshot) -> bool:
    return snapshot.base_currency == CURRENCY_SNAPSHOT_BASE and set(SUPPORTED_CURRENCIES).issubset(
        snapshot.rates
    )


def _latest_snapshot() -> CurrencyRateSnapshot | None:
    return (
        CurrencyRateSnapshot.objects.filter(
            base_currency=CURRENCY_SNAPSHOT_BASE,
            rate_date__lte=timezone.localdate(),
        )
        .order_by("-rate_date", "-fetched_at")
        .first()
    )


def _closest_snapshots(rate_date: date) -> list[CurrencyRateSnapshot]:
    before = (
        CurrencyRateSnapshot.objects.filter(
            base_currency=CURRENCY_SNAPSHOT_BASE,
            rate_date__lt=rate_date,
        )
        .order_by("-rate_date", "-fetched_at")
        .first()
    )
    after = (
        CurrencyRateSnapshot.objects.filter(
            base_currency=CURRENCY_SNAPSHOT_BASE,
            rate_date__gt=rate_date,
        )
        .order_by("rate_date", "-fetched_at")
        .first()
    )
    candidates = [snapshot for snapshot in (before, after) if snapshot is not None]
    return sorted(
        candidates,
        key=lambda snapshot: (
            abs((snapshot.rate_date - rate_date).days),
            0 if snapshot.rate_date < rate_date else 1,
        ),
    )


def get_latest_rates_snapshot() -> CurrencyRateSnapshot:
    today = timezone.localdate()
    cached = (
        CurrencyRateSnapshot.objects.filter(
            base_currency=CURRENCY_SNAPSHOT_BASE,
            rate_date=today,
        )
        .order_by("-fetched_at")
        .first()
    )
    if cached and has_complete_supported_rates(cached):
        return cached
    fallback = _latest_snapshot()
    if settings.CURRENCY_RATE_PROVIDER == "frankfurter":
        try:
            return fetch_frankfurter_rates_snapshot()
        except (KeyError, requests.RequestException, ValueError) as exc:
            if fallback:
                return fallback
            raise DomainError(
                ErrorCode.CURRENCY_RATE_UNAVAILABLE,
                "Currency conversion rates could not be fetched.",
            ) from exc
    if settings.CURRENCY_RATE_PROVIDER == "placeholder":
        if fallback:
            return fallback
        raise DomainError(
            ErrorCode.CURRENCY_RATE_UNAVAILABLE,
            "Currency conversion provider is not configured.",
        )
    raise DomainError(
        ErrorCode.CURRENCY_RATE_UNAVAILABLE,
        f"Unsupported currency provider: {settings.CURRENCY_RATE_PROVIDER}",
    )


def _snapshot_rate(snapshot: CurrencyRateSnapshot, currency: str) -> Decimal:
    rate = Decimal(str(snapshot.rates[currency]))
    if rate <= 0:
        raise ValueError(f"Currency rate must be positive: {currency}")
    return rate


def rate_from_snapshot(
    snapshot: CurrencyRateSnapshot, base_currency: str, quote_currency: str
) -> CurrencyRate:
    base_currency, quote_currency = _normal_pair(base_currency, quote_currency)
    if base_currency == quote_currency:
        return _identity_rate(base_currency, quote_currency, snapshot.rate_date)
    try:
        base_rate = _snapshot_rate(snapshot, base_currency)
        quote_rate = _snapshot_rate(snapshot, quote_currency)
        rate = (quote_rate / base_rate).quantize(RATE_PRECISION)
    except (KeyError, InvalidOperation, ValueError) as exc:
        raise DomainError(
            ErrorCode.CURRENCY_RATE_UNAVAILABLE,
            "Currency conversion rate is not available in the latest snapshot.",
        ) from exc
    return CurrencyRate(
        base_currency=base_currency,
        quote_currency=quote_currency,
        rate=rate,
        source=snapshot.source,
        fetched_at=snapshot.fetched_at,
        rate_date=snapshot.rate_date,
    )


def get_latest_rate(base_currency: str, quote_currency: str) -> CurrencyRate:
    base_currency, quote_currency = _normal_pair(base_currency, quote_currency)
    if base_currency == quote_currency:
        return _identity_rate(base_currency, quote_currency, timezone.localdate())
    return rate_from_snapshot(get_latest_rates_snapshot(), base_currency, quote_currency)


def get_rate_for_date(
    base_currency: str, quote_currency: str, rate_date: date
) -> CurrencyRate:
    base_currency, quote_currency = _normal_pair(base_currency, quote_currency)
    if base_currency == quote_currency:
        return _identity_rate(base_currency, quote_currency, rate_date)
    cached = (
        CurrencyRateSnapshot.objects.filter(
            base_currency=CURRENCY_SNAPSHOT_BASE,
            rate_date=rate_date,
        )
        .order_by("-fetched_at")
        .first()
    )
    if cached is not None:
        try:
            return rate_from_snapshot(cached, base_currency, quote_currency)
        except DomainError:
            pass
    if settings.CURRENCY_RATE_PROVIDER == "frankfurter":
        try:
            return rate_from_snapshot(
                fetch_frankfurter_rates_snapshot(rate_date=rate_date),
                base_currency,
                quote_currency,
            )
        except (DomainError, KeyError, requests.RequestException, ValueError):
            pass
    # Last-resort historical fallback: conversion can still proceed, but the
    # CurrencyRate carries the nearest snapshot date, not the requested date.
    for snapshot in _closest_snapshots(rate_date):
        try:
            return rate_from_snapshot(snapshot, base_currency, quote_currency)
        except DomainError:
            pass
    # If no nearby cached snapshot exists at all, use the normal latest-rate
    # path so callers still get provider/current fallback or a typed error.
    return get_latest_rate(base_currency, quote_currency)


def _convert_with_rate(amount, rate: CurrencyRate):
    converted = money(money(amount) * rate.rate)
    return converted, rate


def convert(amount, base_currency: str, quote_currency: str):
    return _convert_with_rate(amount, get_latest_rate(base_currency, quote_currency))


def convert_for_rate_date(amount, base_currency: str, quote_currency: str, rate_date: date):
    return _convert_with_rate(
        amount,
        get_rate_for_date(base_currency, quote_currency, rate_date),
    )

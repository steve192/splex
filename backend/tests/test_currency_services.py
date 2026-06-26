from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
import requests
from django.test import override_settings

from splex.currency.constants import CURRENCY_SNAPSHOT_BASE, SUPPORTED_CURRENCIES
from splex.currency.models import CurrencyRateSnapshot, ExchangeRate
from splex.currency.services import (
    convert,
    fetch_frankfurter_rate,
    get_latest_rate,
    get_latest_rates_snapshot,
)


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_same_currency_returns_identity_rate_without_db():
    rate = get_latest_rate("eur", "EUR")
    assert rate.rate == Decimal("1")
    assert rate.source == "identity"


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_placeholder_provider_uses_cached_rate_when_available():
    cached = ExchangeRate.objects.create(
        base_currency="USD",
        quote_currency="EUR",
        rate=Decimal("0.90000000"),
        source="seed",
    )
    rate = get_latest_rate("usd", "eur")
    assert rate.id == cached.id


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_placeholder_provider_raises_without_cache():
    with pytest.raises(ValueError, match="not configured"):
        get_latest_rate("USD", "EUR")


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_convert_uses_latest_rate():
    ExchangeRate.objects.create(
        base_currency="USD",
        quote_currency="EUR",
        rate=Decimal("0.50000000"),
        source="seed",
    )
    amount, rate = convert("10", "USD", "EUR")
    assert amount == Decimal("5.00")
    assert rate.rate == Decimal("0.50000000")


def _fake_response(rate_value):
    response = MagicMock()
    response.raise_for_status.return_value = None
    response.json.return_value = {"rate": rate_value}
    return response


def _fake_rates_snapshot_response():
    response = MagicMock()
    response.raise_for_status.return_value = None
    response.json.return_value = [
        {"base": CURRENCY_SNAPSHOT_BASE, "quote": currency, "rate": "1.25"}
        for currency in SUPPORTED_CURRENCIES
        if currency != CURRENCY_SNAPSHOT_BASE
    ]
    return response


def test_supported_currencies_match_frankfurter_active_catalog():
    assert len(SUPPORTED_CURRENCIES) == 165
    assert {"EUR", "USD", "XAU", "XDR", "ZWG"}.issubset(SUPPORTED_CURRENCIES)


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="frankfurter")
def test_frankfurter_fetch_stores_and_returns_rate():
    with patch(
        "splex.currency.services.requests.get", return_value=_fake_response("0.9")
    ) as mock_get:
        rate = get_latest_rate("USD", "EUR")
    assert mock_get.called
    assert rate.source == "frankfurter"
    assert rate.rate == Decimal("0.9")
    # The fetched rate is persisted for later cache hits.
    assert ExchangeRate.objects.filter(base_currency="USD", quote_currency="EUR").exists()


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="frankfurter")
def test_frankfurter_fetches_one_complete_daily_snapshot():
    with patch(
        "splex.currency.services.requests.get",
        return_value=_fake_rates_snapshot_response(),
    ) as mock_get:
        snapshot = get_latest_rates_snapshot()
        cached_snapshot = get_latest_rates_snapshot()

    assert cached_snapshot.id == snapshot.id
    assert snapshot.base_currency == CURRENCY_SNAPSHOT_BASE
    expected_rates = {
        currency: "1.25"
        for currency in SUPPORTED_CURRENCIES
        if currency != CURRENCY_SNAPSHOT_BASE
    } | {CURRENCY_SNAPSHOT_BASE: "1"}
    assert snapshot.rates == expected_rates
    mock_get.assert_called_once_with(
        "https://api.frankfurter.dev/v2/rates",
        params={"base": "EUR"},
        timeout=10,
    )


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="frankfurter")
def test_rates_snapshot_failure_uses_previous_snapshot():
    cached = CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rates={"EUR": "1", "USD": "1.08"},
        source="seed",
    )
    CurrencyRateSnapshot.objects.filter(id=cached.id).update(
        fetched_at=cached.fetched_at.replace(year=2000)
    )

    with patch(
        "splex.currency.services.requests.get",
        side_effect=requests.RequestException("boom"),
    ):
        snapshot = get_latest_rates_snapshot()

    assert snapshot.id == cached.id


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="frankfurter")
def test_incomplete_snapshot_is_refreshed_even_when_fetched_today():
    incomplete = CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rates={"EUR": "1", "USD": "1.08"},
        source="frankfurter",
    )

    with patch(
        "splex.currency.services.requests.get",
        return_value=_fake_rates_snapshot_response(),
    ):
        snapshot = get_latest_rates_snapshot()

    assert snapshot.id != incomplete.id
    assert set(snapshot.rates) == set(SUPPORTED_CURRENCIES)


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="frankfurter")
def test_frankfurter_failure_falls_back_to_cached_rate():
    cached = ExchangeRate.objects.create(
        base_currency="USD",
        quote_currency="EUR",
        rate=Decimal("0.80000000"),
        source="seed",
    )
    # Force a stale cache (yesterday) so the service tries to fetch, then fails.
    ExchangeRate.objects.filter(id=cached.id).update(
        fetched_at=cached.fetched_at.replace(year=2000)
    )
    with patch(
        "splex.currency.services.requests.get",
        side_effect=requests.RequestException("boom"),
    ):
        rate = get_latest_rate("USD", "EUR")
    assert rate.id == cached.id


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="frankfurter")
def test_frankfurter_failure_without_cache_raises():
    with patch(
        "splex.currency.services.requests.get",
        side_effect=requests.RequestException("boom"),
    ):
        with pytest.raises(ValueError, match="could not be fetched"):
            get_latest_rate("USD", "EUR")


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="unknown-provider")
def test_unsupported_provider_raises():
    with pytest.raises(ValueError, match="Unsupported currency provider"):
        get_latest_rate("USD", "EUR")


@pytest.mark.django_db
def test_fetch_frankfurter_rate_parses_payload():
    with patch("splex.currency.services.requests.get", return_value=_fake_response("1.25")):
        rate = fetch_frankfurter_rate("EUR", "USD")
    assert rate.rate == Decimal("1.25")
    assert rate.base_currency == "EUR"
    assert rate.quote_currency == "USD"

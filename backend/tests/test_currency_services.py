from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
import requests
from django.test import override_settings
from django.utils import timezone

from splex.currency.constants import CURRENCY_SNAPSHOT_BASE, SUPPORTED_CURRENCIES
from splex.currency.models import CurrencyRateSnapshot
from splex.currency.services import (
    convert,
    get_latest_rate,
    get_latest_rates_snapshot,
    get_rate_for_date,
    rate_from_snapshot,
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
    cached = CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rates={"EUR": "1", "USD": "2"},
        source="seed",
    )
    rate = get_latest_rate("usd", "eur")
    assert rate.rate == Decimal("0.50000000")
    assert rate.source == cached.source
    assert rate.fetched_at == cached.fetched_at


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_placeholder_provider_raises_without_cache():
    with pytest.raises(ValueError, match="not configured"):
        get_latest_rate("USD", "EUR")


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_convert_uses_latest_rate():
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rates={"EUR": "1", "USD": "2"},
        source="seed",
    )
    amount, rate = convert("10", "USD", "EUR")
    assert amount == Decimal("5.00")
    assert rate.rate == Decimal("0.50000000")


def _fake_rates_snapshot_response(rate_value="1.25"):
    response = MagicMock()
    response.raise_for_status.return_value = None
    response.json.return_value = [
        {"base": CURRENCY_SNAPSHOT_BASE, "quote": currency, "rate": rate_value}
        for currency in SUPPORTED_CURRENCIES
        if currency != CURRENCY_SNAPSHOT_BASE
    ]
    return response


def test_supported_currencies_match_frankfurter_active_catalog():
    assert len(SUPPORTED_CURRENCIES) == 165
    assert {"EUR", "USD", "XAU", "XDR", "ZWG"}.issubset(SUPPORTED_CURRENCIES)


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="frankfurter")
def test_frankfurter_fetch_stores_snapshot_and_returns_derived_rate():
    with patch(
        "splex.currency.services.requests.get",
        return_value=_fake_rates_snapshot_response(),
    ) as mock_get:
        rate = get_latest_rate("USD", "EUR")
    mock_get.assert_called_once_with(
        "https://api.frankfurter.dev/v2/rates",
        params={"base": "EUR"},
        timeout=10,
    )
    assert rate.source == "frankfurter"
    assert rate.rate == Decimal("0.80000000")
    assert CurrencyRateSnapshot.objects.filter(source="frankfurter").exists()


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
    assert snapshot.rate_date == timezone.localdate()
    expected_rates = {
        currency: "1.25" for currency in SUPPORTED_CURRENCIES if currency != CURRENCY_SNAPSHOT_BASE
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
    cached = CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rates={"EUR": "1", "USD": "1.25"},
        source="seed",
    )
    # Force a stale cache (yesterday) so the service tries to fetch, then fails.
    CurrencyRateSnapshot.objects.filter(id=cached.id).update(
        fetched_at=cached.fetched_at.replace(year=2000)
    )
    with patch(
        "splex.currency.services.requests.get",
        side_effect=requests.RequestException("boom"),
    ):
        rate = get_latest_rate("USD", "EUR")
    assert rate.rate == Decimal("0.80000000")
    assert rate.source == "seed"


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="frankfurter")
def test_frankfurter_failure_without_cache_raises():
    with patch(
        "splex.currency.services.requests.get",
        side_effect=requests.RequestException("boom"),
    ):
        with pytest.raises(ValueError, match="rates could not be fetched"):
            get_latest_rate("USD", "EUR")


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="unknown-provider")
def test_unsupported_provider_raises():
    with pytest.raises(ValueError, match="Unsupported currency provider"):
        get_latest_rate("USD", "EUR")


@pytest.mark.django_db
def test_rate_from_snapshot_derives_cross_currency_rate():
    snapshot = CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rates={"EUR": "1", "USD": "1.25", "JPY": "200"},
        source="seed",
    )
    rate = rate_from_snapshot(snapshot, "USD", "JPY")
    assert rate.rate == Decimal("160.00000000")
    assert rate.base_currency == "USD"
    assert rate.quote_currency == "JPY"


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="frankfurter")
def test_historical_rate_uses_cached_snapshot_for_requested_date():
    rate_date = date(2025, 1, 15)
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rate_date=rate_date,
        rates={"EUR": "1", "USD": "2"},
        source="seed",
    )
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rates={"EUR": "1", "USD": "4"},
        source="current",
    )

    rate = get_rate_for_date("USD", "EUR", rate_date)

    assert rate.rate == Decimal("0.50000000")
    assert rate.source == "seed"


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="frankfurter")
def test_historical_rate_fetches_requested_date_when_not_cached():
    rate_date = date(2025, 1, 15)
    with patch(
        "splex.currency.services.requests.get",
        return_value=_fake_rates_snapshot_response("2"),
    ) as mock_get:
        rate = get_rate_for_date("USD", "EUR", rate_date)

    assert rate.rate == Decimal("0.50000000")
    mock_get.assert_called_once_with(
        "https://api.frankfurter.dev/v2/rates",
        params={"base": "EUR", "date": "2025-01-15"},
        timeout=10,
    )
    assert CurrencyRateSnapshot.objects.filter(rate_date=rate_date).exists()


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="frankfurter")
def test_historical_rate_falls_back_to_closest_cached_rate_when_history_unavailable():
    rate_date = date(2025, 1, 15)
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rate_date=date(2025, 1, 10),
        rates={"EUR": "1", "USD": "2"},
        source="closest",
    )
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rate_date=date(2025, 6, 1),
        rates={"EUR": "1", "USD": "4"},
        source="farther",
    )
    with patch(
        "splex.currency.services.requests.get",
        side_effect=requests.RequestException("boom"),
    ):
        rate = get_rate_for_date("USD", "EUR", rate_date)

    assert rate.rate == Decimal("0.50000000")
    assert rate.source == "closest"
    assert rate.rate_date == date(2025, 1, 10)


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="frankfurter")
def test_historical_rate_can_fall_back_to_closest_later_cached_rate():
    rate_date = date(2025, 1, 15)
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rate_date=date(2024, 12, 1),
        rates={"EUR": "1", "USD": "2"},
        source="before",
    )
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rate_date=date(2025, 1, 20),
        rates={"EUR": "1", "USD": "4"},
        source="closest-after",
    )
    with patch(
        "splex.currency.services.requests.get",
        side_effect=requests.RequestException("boom"),
    ):
        rate = get_rate_for_date("USD", "EUR", rate_date)

    assert rate.rate == Decimal("0.25000000")
    assert rate.source == "closest-after"
    assert rate.rate_date == date(2025, 1, 20)

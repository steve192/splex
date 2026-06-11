from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
import requests
from django.test import override_settings

from splex.currency.models import ExchangeRate
from splex.currency.services import convert, fetch_frankfurter_rate, get_latest_rate


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

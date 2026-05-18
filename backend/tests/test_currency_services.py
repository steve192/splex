from decimal import Decimal

import pytest
from django.test import override_settings

from splex.currency.models import ExchangeRate
from splex.currency.services import convert, get_latest_rate


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

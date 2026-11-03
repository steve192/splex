from datetime import date

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from splex.accounts.models import User
from splex.currency.constants import SUPPORTED_CURRENCIES
from splex.currency.models import CurrencyRateSnapshot
from splex.shared.api import ApiErrorCode


@pytest.mark.django_db
def test_currency_rates_api_returns_snapshot_with_backend_fetch_timestamp():
    user = User.objects.create_user(email="currency@example.com")
    snapshot = CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rates={currency: "1" for currency in SUPPORTED_CURRENCIES},
        source="frankfurter",
    )
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get("/api/currency/rates/")

    assert response.status_code == 200
    assert response.data == {
        "base_currency": "EUR",
        "rates": {currency: "1" for currency in SUPPORTED_CURRENCIES},
        "source": "frankfurter",
        "fetched_at": snapshot.fetched_at.isoformat(),
    }


@pytest.mark.django_db
@override_settings(CURRENCY_RATE_PROVIDER="placeholder")
def test_currency_rate_api_returns_official_rate_for_date():
    user = User.objects.create_user(email="currency@example.com")
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR",
        rate_date=date(2026, 11, 2),
        rates={"EUR": "1", "NOK": "10"},
        source="historic",
    )
    CurrencyRateSnapshot.objects.create(
        base_currency="EUR", rates={"EUR": "1", "NOK": "12"}, source="current"
    )
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get(
        "/api/currency/rate/",
        {"base_currency": "NOK", "quote_currency": "EUR", "date": "2026-11-02"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "base_currency": "NOK",
        "quote_currency": "EUR",
        "rate": "0.10000000",
        "rate_date": "2026-11-02",
        "source": "historic",
    }


@pytest.mark.django_db
def test_currency_rate_api_rejects_unsupported_currency():
    user = User.objects.create_user(email="currency@example.com")
    client = APIClient()
    client.force_authenticate(user=user)

    response = client.get(
        "/api/currency/rate/", {"base_currency": "XXX", "quote_currency": "EUR"}
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == ApiErrorCode.VALIDATION_ERROR

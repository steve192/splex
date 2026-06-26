import pytest
from rest_framework.test import APIClient

from splex.accounts.models import User
from splex.currency.constants import SUPPORTED_CURRENCIES
from splex.currency.models import CurrencyRateSnapshot


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

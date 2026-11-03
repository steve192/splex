from rest_framework import serializers

from splex.currency.constants import SUPPORTED_CURRENCIES


class CurrencyRateQuerySerializer(serializers.Serializer):
    base_currency = serializers.ChoiceField(choices=SUPPORTED_CURRENCIES)
    quote_currency = serializers.ChoiceField(choices=SUPPORTED_CURRENCIES)
    date = serializers.DateField(required=False)

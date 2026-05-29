from rest_framework import serializers

from splex.accounts.payments import render_paypal
from splex.shared.media import signed_media_url


def serialize_payment_method(method):
    """Return the JSON shape the frontend expects for one PaymentMethod row.

    Includes both storage fields (``kind``, ``identifier``) and the rendered
    "Pay with" data so the settle popup can render a one-tap button without
    having to know how PayPal URLs are built.
    """
    rendered = render_paypal(method)
    return {
        "id": method.id,
        "kind": method.kind,
        "identifier": method.identifier,
        "is_preferred": method.is_preferred,
        "display": rendered.display,
        "url": rendered.url,
        "pre_fills_recipient": rendered.pre_fills_recipient,
    }


class PaymentMethodCreateSerializer(serializers.Serializer):
    """Free-form PayPal input that the server parses into ``(kind, identifier)``.

    The frontend offers one text field; we accept paypal.me links, bare
    handles, or email addresses interchangeably and normalise them here.
    """

    paypal = serializers.CharField(max_length=300, trim_whitespace=True)
    make_preferred = serializers.BooleanField(default=False)


class PaymentMethodUpdateSerializer(serializers.Serializer):
    is_preferred = serializers.BooleanField()


class MagicLinkRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    invite_token = serializers.CharField(required=False, allow_blank=True)


class MagicCodeVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=6, max_length=12)


class MagicTokenVerifySerializer(serializers.Serializer):
    token = serializers.CharField()


class UserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    display_name = serializers.CharField()
    default_currency = serializers.CharField()
    avatar_url = serializers.SerializerMethodField()
    push_enabled = serializers.BooleanField()
    locale = serializers.CharField()
    location_tracking_enabled = serializers.BooleanField()

    def get_avatar_url(self, user):
        return signed_media_url(user.avatar_url)


class UserUpdateSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    default_currency = serializers.CharField(min_length=3, max_length=3, required=False)
    avatar_image = serializers.CharField(required=False, allow_blank=True)
    avatar_attribution = serializers.CharField(required=False, allow_blank=True)
    push_enabled = serializers.BooleanField(required=False)
    locale = serializers.CharField(max_length=8, required=False)
    location_tracking_enabled = serializers.BooleanField(required=False)

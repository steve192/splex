from rest_framework import serializers


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
    avatar_url = serializers.CharField()
    push_enabled = serializers.BooleanField()


class UserUpdateSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    default_currency = serializers.CharField(min_length=3, max_length=3, required=False)
    avatar_image = serializers.CharField(required=False, allow_blank=True)
    push_enabled = serializers.BooleanField(required=False)

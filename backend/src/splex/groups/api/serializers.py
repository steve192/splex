from rest_framework import serializers

from splex.participants.services import participant_avatar_url
from splex.shared.media import signed_media_url


class ParticipantSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    display_name = serializers.CharField(source="effective_display_name", read_only=True)
    kind = serializers.CharField()
    user_id = serializers.IntegerField(allow_null=True)
    avatar_url = serializers.SerializerMethodField()

    def get_avatar_url(self, participant):
        return participant_avatar_url(participant)


class GroupSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    icon_url = serializers.SerializerMethodField()
    default_currency = serializers.CharField()
    default_split_method = serializers.CharField()
    default_split_payload = serializers.JSONField()
    archived_at = serializers.DateTimeField(allow_null=True)
    deleted_at = serializers.DateTimeField(allow_null=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    last_expense_date = serializers.SerializerMethodField()

    def get_icon_url(self, group):
        return signed_media_url(group.icon_url)

    def get_last_expense_date(self, group):
        from splex.expenses.models import Expense
        latest = Expense.objects.filter(group=group, deleted_at__isnull=True).order_by("-date").first()
        return latest.date if latest else None


class GroupCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=180)
    default_currency = serializers.CharField(min_length=3, max_length=3)


class GroupUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=180, required=False)
    icon_image = serializers.CharField(required=False, allow_blank=True)
    default_currency = serializers.CharField(min_length=3, max_length=3, required=False)
    default_split_method = serializers.CharField(max_length=40, required=False)
    default_split_payload = serializers.JSONField(required=False)
    archived = serializers.BooleanField(required=False)


class AddParticipantSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=150, required=False)
    friend_participant_id = serializers.IntegerField(required=False)

    def validate(self, attrs):
        has_display_name = bool((attrs.get("display_name") or "").strip())
        has_friend_participant_id = attrs.get("friend_participant_id") is not None
        if has_display_name == has_friend_participant_id:
            raise serializers.ValidationError(
                "Provide exactly one of display_name or friend_participant_id."
            )
        if has_display_name:
            attrs["display_name"] = attrs["display_name"].strip()
        return attrs


class RenameParticipantSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=150)


class ExpenseCreateSerializer(serializers.Serializer):
    client_id = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(max_length=240)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField(min_length=3, max_length=3)
    date = serializers.DateField(required=False)
    split_method = serializers.CharField(required=False)
    split_payload = serializers.JSONField(required=False)
    payments = serializers.ListField(child=serializers.DictField(), required=False)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    approximate_location = serializers.CharField(max_length=255, required=False, allow_blank=True)


class SettlementCreateSerializer(serializers.Serializer):
    client_id = serializers.CharField(required=False, allow_blank=True)
    payer_participant_id = serializers.IntegerField()
    receiver_participant_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField(min_length=3, max_length=3, required=False)


class InvitationCreateSerializer(serializers.Serializer):
    target_participant_id = serializers.IntegerField(required=False)

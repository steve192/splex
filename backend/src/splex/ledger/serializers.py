from splex.expenses.models import Expense
from splex.participants.models import Participant
from splex.participants.services import participant_avatar_url


def serialize_expense(expense):
    participant_ids = [
        *(share.participant_id for share in expense.payment_shares.all()),
        *(share.participant_id for share in expense.owed_shares.all()),
    ]
    participants = Participant.objects.filter(id__in=participant_ids).select_related("user")
    participant_names = {participant.id: participant.display_name for participant in participants}
    participant_avatars = {
        participant.id: participant_avatar_url(participant)
        for participant in participants
    }
    return {
        "id": expense.id,
        "client_id": expense.client_id,
        "group_id": expense.group_id,
        "friendship_id": expense.friendship_id,
        "description": expense.description,
        "date": expense.date,
        "original_amount": str(expense.original_amount),
        "original_currency": expense.original_currency,
        "converted_amount": str(expense.converted_amount),
        "converted_currency": expense.converted_currency,
        "split_method": expense.split_method,
        "split_payload": expense.split_metadata,
        "deleted_at": expense.deleted_at,
        "payments": [
            {
                "participant_id": share.participant_id,
                "display_name": participant_names.get(share.participant_id, ""),
                "avatar_url": participant_avatars.get(share.participant_id, ""),
                "amount": str(share.amount),
            }
            for share in expense.payment_shares.all()
        ],
        "owed": [
            {
                "participant_id": share.participant_id,
                "display_name": participant_names.get(share.participant_id, ""),
                "avatar_url": participant_avatars.get(share.participant_id, ""),
                "amount": str(share.amount),
            }
            for share in expense.owed_shares.all()
        ],
    }


def serialize_settlement(settlement):
    return {
        "id": settlement.id,
        "group_id": settlement.group_id,
        "friendship_id": settlement.friendship_id,
        "payer_participant_id": settlement.payer_participant_id,
        "receiver_participant_id": settlement.receiver_participant_id,
        "payer_display_name": settlement.payer_participant.display_name,
        "receiver_display_name": settlement.receiver_participant.display_name,
        "payer_avatar_url": participant_avatar_url(settlement.payer_participant),
        "receiver_avatar_url": participant_avatar_url(settlement.receiver_participant),
        "amount": str(settlement.amount),
        "currency": settlement.currency,
        "created_at": settlement.created_at,
        "deleted_at": settlement.deleted_at,
    }


def serialize_ledger_item(item):
    if isinstance(item, Expense):
        return {
            "type": "expense",
            "occurred_at": item.created_at.isoformat(),
            "expense": serialize_expense(item),
        }
    return {
        "type": "settlement",
        "occurred_at": item.created_at.isoformat(),
        "settlement": serialize_settlement(item),
    }

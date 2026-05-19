"""Canonical activity event type names. Use these constants instead of string literals."""


class EventType:
    GROUP_CREATED = "group.created"
    GROUP_UPDATED = "group.updated"
    GROUP_DELETED = "group.deleted"
    GROUP_MEMBER_ADDED = "group.member_added"
    GROUP_MEMBER_INVITED = "group.member_invited"
    GROUP_MEMBER_JOINED = "group.member_joined"
    GROUP_MEMBER_REMOVED = "group.member_removed"
    GROUP_MEMBER_RENAMED = "group.member_renamed"

    FRIEND_INVITED = "friend.invited"
    FRIEND_ACCEPTED = "friend.accepted"

    INVITATION_ACCEPTED = "invitation.accepted"

    EXPENSE_CREATED = "expense.created"
    EXPENSE_UPDATED = "expense.updated"
    EXPENSE_DELETED = "expense.deleted"

    SETTLEMENT_CREATED = "settlement.created"
    SETTLEMENT_UPDATED = "settlement.updated"
    SETTLEMENT_DELETED = "settlement.deleted"

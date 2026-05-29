"""User-triggered "nudge" push notifications.

Reminders sit alongside the activity-driven notification flow but skip the
``Notification`` audit log because:

* they're sent on demand by a user, not derived from a domain event,
* there's nothing meaningful to render later in the activity feed for them,
* every dispatch counts toward DRF throttles so we don't need the row to
  rate-limit them.

Each helper returns ``(recipient_count, sent_count, error_strings)`` so the
API layer can surface a useful response, including the "nobody had a push
subscription enabled" case.
"""

from __future__ import annotations

import logging

from splex.notifications.services import dispatch_push_to_user
from splex.notifications.translations import render_notification

logger = logging.getLogger(__name__)


def _actor_name(actor) -> str:
    return actor.display_name or actor.email.split("@")[0]


def _dispatch_reminder(*, recipient, event_type: str, payload: dict, log_id: str):
    locale = getattr(recipient, "locale", "en") or "en"
    title, body = render_notification(event_type, payload, locale)
    return dispatch_push_to_user(
        recipient, title=title, body=body, data=payload, log_id=log_id,
    )


def send_settle_reminder_in_group(*, actor, group, debtor_user,
                                  amount, currency: str):
    """Nudge ``debtor_user`` to settle ``amount`` ``currency`` with ``actor`` in
    ``group``.  Caller is responsible for verifying group membership and that
    the debtor actually owes money - this function just sends.
    """
    payload = {
        "actor": _actor_name(actor),
        "context": group.name,
        "amount": str(amount),
        "currency": currency,
        "kind": "reminder.settle",
        "group_id": group.id,
    }
    sent, errors = _dispatch_reminder(
        recipient=debtor_user, event_type="reminder.settle",
        payload=payload, log_id=f"reminder.settle group_id={group.id}",
    )
    return sent, errors


def send_settle_reminder_in_friendship(*, actor, friendship, debtor_user,
                                       amount, currency: str):
    """Nudge ``debtor_user`` to settle ``amount`` with ``actor`` in a
    two-person friendship context.  Friend-context body skips the ``{context}``
    placeholder since there's only one other person to settle with.
    """
    payload = {
        "actor": _actor_name(actor),
        "amount": str(amount),
        "currency": currency,
        "kind": "reminder.settle.friend",
        "friendship_id": friendship.id,
    }
    sent, errors = _dispatch_reminder(
        recipient=debtor_user, event_type="reminder.settle.friend",
        payload=payload, log_id=f"reminder.settle friendship_id={friendship.id}",
    )
    return sent, errors


def send_track_expense_reminder_in_group(*, actor, group):
    """Nudge every other registered member of ``group`` to add any expenses
    they may have forgotten.  Unregistered participants are skipped (no push
    endpoint).  Returns ``(recipient_count, sent_count, errors)``.
    """
    # Local import avoids a cycle with services.users_for_context.
    from splex.notifications.services import users_for_context

    recipients = list(users_for_context(group=group).exclude(id=actor.id))
    payload_base = {
        "actor": _actor_name(actor),
        "context": group.name,
        "kind": "reminder.track_expense",
        "group_id": group.id,
    }
    sent_total = 0
    all_errors: list[str] = []
    for recipient in recipients:
        sent, errors = _dispatch_reminder(
            recipient=recipient, event_type="reminder.track_expense",
            payload=payload_base,
            log_id=f"reminder.track_expense group_id={group.id}",
        )
        if sent:
            sent_total += 1
        all_errors.extend(errors)
    return len(recipients), sent_total, all_errors


def send_track_expense_reminder_in_friendship(*, actor, friendship,
                                              other_user):
    """Nudge the other side of a friendship to add any forgotten expenses.

    The caller verifies the friendship and resolves the other participant's
    registered user.  Unregistered placeholders are caught earlier and never
    reach this function.
    """
    payload = {
        "actor": _actor_name(actor),
        "kind": "reminder.track_expense.friend",
        "friendship_id": friendship.id,
    }
    sent, errors = _dispatch_reminder(
        recipient=other_user, event_type="reminder.track_expense.friend",
        payload=payload,
        log_id=f"reminder.track_expense friendship_id={friendship.id}",
    )
    return sent, errors

from rest_framework.response import Response
from rest_framework.views import APIView

from splex.activity.models import ActivityEvent
from splex.participants.models import Participant
from splex.shared.media import signed_media_url


def activity_context(event, user):
    if event.group_id:
        return {"context_type": "group", "context_name": event.group.name}
    if event.friendship_id:
        participant = getattr(user, "participant", None)
        if participant and event.friendship.participant_a_id == participant.id:
            return {
                "context_type": "friend",
                "context_name": event.friendship.participant_b.effective_display_name,
            }
        if participant and event.friendship.participant_b_id == participant.id:
            return {
                "context_type": "friend",
                "context_name": event.friendship.participant_a.effective_display_name,
            }
        return {
            "context_type": "friend",
            "context_name": (
                f"{event.friendship.participant_a.effective_display_name} / "
                f"{event.friendship.participant_b.effective_display_name}"
            ),
        }
    return {"context_type": "", "context_name": ""}


def resolve_subject_name(event, prefetched_participants: dict[int, Participant]) -> str:
    """Return the live name of the participant this event acts on, if known.

    New events store `target_participant_id` in the payload; we look it up and
    return its current name. Falls back to the legacy `participantName` snapshot
    for events recorded before this refactor.
    """
    payload = event.payload or {}
    target_id = payload.get("target_participant_id")
    if isinstance(target_id, int):
        target = prefetched_participants.get(target_id)
        if target:
            return target.effective_display_name
    legacy = payload.get("participantName") or payload.get("friendName")
    return str(legacy) if legacy else ""


def visible_activity_events(user):
    """Every activity event the user may see: those in their groups, their
    friendships, or that they performed themselves."""
    events = ActivityEvent.objects.filter(group__memberships__participant__user=user)
    events = events | ActivityEvent.objects.filter(friendship__participant_a__user=user)
    events = events | ActivityEvent.objects.filter(friendship__participant_b__user=user)
    events = events | ActivityEvent.objects.filter(actor=user)
    return events.distinct().select_related(
        "actor",
        "group",
        "friendship",
        "friendship__participant_a",
        "friendship__participant_a__user",
        "friendship__participant_b",
        "friendship__participant_b__user",
        "settlement",
        "settlement__payer_participant",
        "settlement__payer_participant__user",
        "settlement__receiver_participant",
        "settlement__receiver_participant__user",
    )


def serialize_activity_events(events, user):
    target_ids = {
        payload.get("target_participant_id")
        for event in events
        for payload in [event.payload or {}]
        if isinstance(payload.get("target_participant_id"), int)
    }
    targets = {
        participant.id: participant
        for participant in Participant.objects.filter(id__in=target_ids).select_related("user")
    }
    rows = []
    for event in events:
        context = activity_context(event, user)
        payload = dict(event.payload or {})
        if event.settlement_id and event.settlement:
            payload.setdefault(
                "fromName", event.settlement.payer_participant.effective_display_name
            )
            payload.setdefault(
                "toName", event.settlement.receiver_participant.effective_display_name
            )
        rows.append(
            {
                "id": event.id,
                "event_type": event.event_type,
                # actor is SET_NULL when the user deletes their account, so the
                # historical event survives with no actor. Send empty strings and
                # let the client render a localized "deleted user" placeholder.
                "actor": str(event.actor) if event.actor else "",
                "actor_avatar_url": (
                    signed_media_url(event.actor.avatar_url) if event.actor else ""
                ),
                "payload": payload,
                "subject_name": resolve_subject_name(event, targets),
                "created_at": event.created_at,
                "group_id": event.group_id,
                "friendship_id": event.friendship_id,
                **context,
                "expense_id": event.expense_id,
                "settlement_id": event.settlement_id,
            }
        )
    return rows


def activity_row_matches_search(row, term):
    payload = row.get("payload") or {}
    parts = [
        str(row.get("actor") or ""),
        str(row.get("event_type") or ""),
        str(row.get("context_name") or ""),
        str(row.get("subject_name") or ""),
        *(str(value) for value in payload.values()),
    ]
    return term in " ".join(parts).lower()


class ActivityListView(APIView):
    def get(self, request):
        limit = min(int(request.query_params.get("limit", 50)), 100)
        offset = max(int(request.query_params.get("offset", 0)), 0)
        term = (request.query_params.get("search") or "").strip().lower()
        query = visible_activity_events(request.user)
        if term:
            # Searching matches against the serialized row (actor, amounts,
            # descriptions, names, context, event type), so the whole feed is
            # materialized and filtered before paginating.
            rows = [
                row
                for row in serialize_activity_events(list(query), request.user)
                if activity_row_matches_search(row, term)
            ]
            page = rows[offset : offset + limit]
        else:
            page = serialize_activity_events(list(query[offset : offset + limit]), request.user)
        return Response(
            {
                "results": page,
                "next_offset": offset + limit if len(page) == limit else None,
            }
        )

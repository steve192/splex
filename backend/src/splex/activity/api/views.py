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


class ActivityListView(APIView):
    def get(self, request):
        limit = min(int(request.query_params.get("limit", 50)), 100)
        offset = max(int(request.query_params.get("offset", 0)), 0)
        events = ActivityEvent.objects.filter(
            group__memberships__participant__user=request.user
        )
        events = events | ActivityEvent.objects.filter(
            friendship__participant_a__user=request.user
        )
        events = events | ActivityEvent.objects.filter(
            friendship__participant_b__user=request.user
        )
        events = events | ActivityEvent.objects.filter(actor=request.user)
        query = events.distinct().select_related(
            "actor",
            "group",
            "friendship",
            "friendship__participant_a",
            "friendship__participant_a__user",
            "friendship__participant_b",
            "friendship__participant_b__user",
        )
        page = list(query[offset : offset + limit])
        target_ids = {
            payload.get("target_participant_id")
            for event in page
            for payload in [event.payload or {}]
            if isinstance(payload.get("target_participant_id"), int)
        }
        targets = {
            participant.id: participant
            for participant in Participant.objects.filter(id__in=target_ids).select_related("user")
        }
        rows = []
        for event in page:
            context = activity_context(event, request.user)
            rows.append(
                {
                    "id": event.id,
                    "event_type": event.event_type,
                    "actor": str(event.actor),
                    "actor_avatar_url": signed_media_url(event.actor.avatar_url),
                    "payload": event.payload,
                    "subject_name": resolve_subject_name(event, targets),
                    "created_at": event.created_at,
                    "group_id": event.group_id,
                    "friendship_id": event.friendship_id,
                    **context,
                    "expense_id": event.expense_id,
                    "settlement_id": event.settlement_id,
                }
            )
        return Response(
            {
                "results": rows,
                "next_offset": offset + limit if len(rows) == limit else None,
            }
        )

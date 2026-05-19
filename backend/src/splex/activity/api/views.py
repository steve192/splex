from rest_framework.response import Response
from rest_framework.views import APIView

from splex.activity.models import ActivityEvent
from splex.shared.media import signed_media_url


def activity_context(event, user):
    if event.group_id:
        return {"context_type": "group", "context_name": event.group.name}
    if event.friendship_id:
        participant = getattr(user, "participant", None)
        if participant and event.friendship.participant_a_id == participant.id:
            return {
                "context_type": "friend",
                "context_name": event.friendship.participant_b.display_name,
            }
        if participant and event.friendship.participant_b_id == participant.id:
            return {
                "context_type": "friend",
                "context_name": event.friendship.participant_a.display_name,
            }
        return {
            "context_type": "friend",
            "context_name": (
                f"{event.friendship.participant_a.display_name} / "
                f"{event.friendship.participant_b.display_name}"
            ),
        }
    return {"context_type": "", "context_name": ""}


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
            "friendship__participant_b",
        )
        rows = []
        for event in query[offset : offset + limit]:
            context = activity_context(event, request.user)
            rows.append(
                {
                    "id": event.id,
                    "event_type": event.event_type,
                    "actor": str(event.actor),
                    "actor_avatar_url": signed_media_url(event.actor.avatar_url),
                    "payload": event.payload,
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

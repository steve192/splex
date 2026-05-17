from splex.activity.models import ActivityEvent


def record_activity(actor, event_type: str, payload=None, **relations) -> ActivityEvent:
    return ActivityEvent.objects.create(
        actor=actor,
        event_type=event_type,
        payload=payload or {},
        **relations,
    )


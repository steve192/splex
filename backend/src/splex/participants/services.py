from splex.participants.models import Participant
from splex.shared.media import signed_media_url


def get_or_create_user_participant(user) -> Participant:
    if hasattr(user, "participant") and user.participant:
        return user.participant
    display_name = user.display_name or user.email.split("@")[0]
    return Participant.objects.create(
        user=user,
        display_name=display_name,
        kind=Participant.Kind.REGISTERED,
    )


def participant_avatar_url(participant: Participant) -> str:
    if not participant.user_id:
        return ""
    return signed_media_url(participant.user.avatar_url)


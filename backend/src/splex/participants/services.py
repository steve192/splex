from splex.participants.models import Participant


def get_or_create_user_participant(user) -> Participant:
    if hasattr(user, "participant") and user.participant:
        return user.participant
    display_name = user.display_name or user.email.split("@")[0]
    return Participant.objects.create(
        user=user,
        display_name=display_name,
        kind=Participant.Kind.REGISTERED,
    )


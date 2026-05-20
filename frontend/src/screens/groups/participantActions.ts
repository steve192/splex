import { Participant } from "../../shared/types/models";

/**
 * Whether the "Remove" button should be shown for a participant in group settings.
 *
 * The user can never remove themselves; the backend enforces this in
 * `remove_group_participant`, and the UI hides the button to match.
 */
export function canRemoveParticipant(
  participant: Pick<Participant, "id">,
  currentParticipantId: number | null | undefined
): boolean {
  if (currentParticipantId == null) return true;
  return participant.id !== currentParticipantId;
}

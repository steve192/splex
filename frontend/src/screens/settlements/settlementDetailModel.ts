import type { Participant } from "../../shared/types/models";
import type { SelectionOption } from "../../shared/ui/SelectionSheet";

export function settlementParticipantName(
  participants: Participant[],
  participantId: number | null,
): string {
  return (
    participants.find((participant) => participant.id === participantId)
      ?.display_name ?? ""
  );
}

export function settlementParticipantOptions(
  participants: Participant[],
): SelectionOption<number>[] {
  return participants.map((participant) => ({
    value: participant.id,
    label: participant.display_name,
  }));
}

export function canSaveSettlementEdit({
  hasPending,
  amount,
  payerId,
  receiverId,
  groupArchived,
}: Readonly<{
  hasPending: boolean;
  amount: string;
  payerId: number | null;
  receiverId: number | null;
  groupArchived: boolean;
}>): boolean {
  return Boolean(
    !hasPending &&
      amount &&
      payerId &&
      receiverId &&
      payerId !== receiverId &&
      !groupArchived,
  );
}

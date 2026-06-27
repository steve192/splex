import type { Participant } from "../../shared/types/models";

type OutstandingShape = {
  owes: unknown[];
  owed_by: unknown[];
} | null;

export function hasBlockingOutstandingBalance({
  groupWillBeDeleted,
  outstanding,
}: Readonly<{
  groupWillBeDeleted?: boolean;
  outstanding: OutstandingShape;
}>): boolean {
  if (groupWillBeDeleted || !outstanding) return false;
  return outstanding.owes.length > 0 || outstanding.owed_by.length > 0;
}

export function removeParticipantWarningKey(
  target: Pick<Participant, "kind"> | null,
): string {
  return target?.kind === "unregistered"
    ? "group.removeMember.outstandingWarning"
    : "group.removeMember.convertWarning";
}

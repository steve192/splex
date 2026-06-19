export type PendingActionKey = string;

export function canStartPendingAction(
  pending: PendingActionKey | null,
): boolean {
  return pending === null;
}

export function pendingActionMatches(
  pending: PendingActionKey | null,
  key: PendingActionKey,
): boolean {
  return pending === key;
}

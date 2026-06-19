export function canStartPendingAction(
  pending: string | null,
): boolean {
  return pending === null;
}

export function pendingActionMatches(
  pending: string | null,
  key: string,
): boolean {
  return pending === key;
}

export function pendingInviteTokenForAuthSession(
  urlInviteToken: string | null,
  storedInviteToken: string | null
): string | null {
  return urlInviteToken || storedInviteToken;
}

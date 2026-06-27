export function isAuthenticationFailureStatus(status: number | undefined): boolean {
  return status === 401 || status === 403;
}

export function shouldClearStoredAuth(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && isAuthenticationFailureStatus(status);
}

import { shouldClearStoredAuth } from "../../shared/api/authSession";

export type StartupAuthErrorAction = "clear-auth" | "preserve-auth";

export function startupAuthErrorAction(error: unknown): StartupAuthErrorAction {
  return shouldClearStoredAuth(error) ? "clear-auth" : "preserve-auth";
}

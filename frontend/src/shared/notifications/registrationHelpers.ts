/**
 * Pure decision logic for push registration on app launch, extracted from
 * registration.ts so the contract is unit-testable without platform APIs.
 */

export type PushPreference = "on" | "off" | "unset";
export type PermissionDecision = "granted" | "denied" | "undetermined";
export type PushRegistrationStatus =
  | "registered"
  | "permission_denied"
  | "unsupported"
  | "error"
  | "idle";

export type StartupPushDecision = "register" | "skip_disabled" | "skip_permission_denied";

/**
 * Whether an app launch should (re-)register this device's push token.
 *
 * - An explicit "off" on this device wins: the token stays disabled on the
 *   backend and is not re-sent. Only a fresh login clears the preference
 *   (see resetPushPreferenceOnLogin).
 * - A permanently denied OS permission means the prompt cannot be shown, so
 *   registration is skipped without nagging the user.
 * - Everything else registers: the token upload on every launch is the
 *   backend's liveness heartbeat that keeps the row from expiring.
 */
export function decideStartupPushRegistration(
  preference: PushPreference,
  permission: PermissionDecision
): StartupPushDecision {
  if (preference === "off") return "skip_disabled";
  if (permission === "denied") return "skip_permission_denied";
  return "register";
}

/**
 * Which preference (if any) to persist after a startup registration attempt.
 *
 * Only a successful registration is remembered. Persisting "off" after a
 * dismissed permission prompt or an unsupported browser would be
 * indistinguishable from the user's explicit Account-screen "off" and would
 * wrongly suppress all future startup registrations - e.g. after the user
 * later grants the permission in the OS settings. An explicit "off" is only
 * ever written by the user-initiated Account toggle.
 */
export function preferenceToPersistAfterStartup(
  status: PushRegistrationStatus
): PushPreference | null {
  return status === "registered" ? "on" : null;
}

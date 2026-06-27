import * as Location from "expo-location";

export type LocationPermissionState = "granted" | "denied" | "undetermined";

export type BrowserPermissionState = PermissionState | "unsupported";

export function browserPermissionStateToLocationState(
  state: BrowserPermissionState,
): LocationPermissionState {
  if (state === "granted") return "granted";
  if (state === "denied" || state === "unsupported") return "denied";
  return "undetermined";
}

export function expoPermissionStatusToLocationState(
  status: Location.PermissionStatus,
): LocationPermissionState {
  if (status === Location.PermissionStatus.GRANTED) return "granted";
  if (status === Location.PermissionStatus.DENIED) return "denied";
  return "undetermined";
}

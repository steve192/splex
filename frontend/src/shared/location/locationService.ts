import * as Location from "expo-location";
import { Platform } from "react-native";

import { ApiClient } from "../api/client";
import {
  browserPermissionStateToLocationState,
  expoPermissionStatusToLocationState,
  type BrowserPermissionState,
  type LocationPermissionState,
} from "./locationPermissionModel";

let lastLocation: { latitude: number; longitude: number; timestamp: number } | null = null;
const LOCATION_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const LOCATION_REQUEST_TIMEOUT = 8000; // 8s before falling back to last-known

export type { LocationPermissionState } from "./locationPermissionModel";

/**
 * Read the current location permission without prompting the user.
 *
 * Use this when you want to *show* the current state in the UI (e.g. the
 * settings toggle helper text on mount). Use `requestLocationPermission`
 * when the user has just performed an action that warrants asking.
 */
export async function getLocationPermissionStatus(): Promise<LocationPermissionState> {
  if (Platform.OS === "web") {
    return browserPermissionStateToLocationState(await readBrowserPermission());
  }
  const { status } = await Location.getForegroundPermissionsAsync();
  return expoPermissionStatusToLocationState(status);
}

export async function requestLocationPermission(): Promise<LocationPermissionState> {
  if (Platform.OS === "web") {
    if (!browserGeolocationAvailable()) return "denied";
    // Browsers expose permission state via the Permissions API where available; this lets us
    // skip the prompt when the user has already granted/denied location for this origin.
    const browserPermission = await readBrowserPermission();
    if (browserPermission !== "prompt") {
      return browserPermissionStateToLocationState(browserPermission);
    }
    // Actively trigger the browser prompt by requesting a position. Resolves "granted" on
    // success, "denied" when the user blocks the prompt, "undetermined" on timeout or
    // hardware error so the caller doesn't lock the user out.
    return promptBrowserLocationPermission();
  }

  const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
  if (existingStatus === Location.PermissionStatus.GRANTED) {
    return "granted";
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  return expoPermissionStatusToLocationState(status);
}

export async function isLocationEnabled(): Promise<boolean> {
  if (Platform.OS === "web") {
    return true; // Web relies on browser geolocation
  }
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
}

export async function getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
  const now = Date.now();

  // Return cached location if still fresh
  if (lastLocation && now - lastLocation.timestamp < LOCATION_CACHE_TIMEOUT) {
    return { latitude: lastLocation.latitude, longitude: lastLocation.longitude };
  }

  if (Platform.OS === "web") {
    return getWebLocation();
  }

  const enabled = await isLocationEnabled();
  if (!enabled) {
    return null;
  }

  // Android `getCurrentPositionAsync` can hang on cold GPS. Race against a timeout
  // and fall back to the last known fix so the expense form gets a coordinate.
  try {
    const fresh = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), LOCATION_REQUEST_TIMEOUT)
    );
    const winner = await Promise.race([fresh, timeout]);

    const location = winner ?? (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 }));
    if (!location) {
      return null;
    }

    lastLocation = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: now,
    };

    return { latitude: location.coords.latitude, longitude: location.coords.longitude };
  } catch {
    return null;
  }
}

function getWebLocation(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!browserGeolocationAvailable()) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        lastLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now(),
        };
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
}

function browserGeolocationAvailable(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.geolocation);
}

async function readBrowserPermission(): Promise<BrowserPermissionState> {
  if (!browserGeolocationAvailable()) return "unsupported";
  if (typeof navigator.permissions?.query !== "function") return "prompt";

  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    // Some browsers (older Safari, Firefox in private mode) reject.
    return "prompt";
  }
}

function promptBrowserLocationPermission(): Promise<LocationPermissionState> {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve("granted"),
      (error) => {
        resolve(error.code === error.PERMISSION_DENIED ? "denied" : "undetermined");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
}

/**
 * Bootstrap location permission after login.
 * If the user has location tracking enabled, request permission (like push notifications).
 * If permission is not granted, disable the server-side setting so UI and reality match.
 */
export async function bootstrapLocationAfterLogin(
  locationTrackingEnabled: boolean,
  api: ApiClient
): Promise<void> {
  if (!locationTrackingEnabled) {
    return;
  }

  // Web: browser prompts on demand at first geolocation call, nothing to bootstrap.
  if (Platform.OS === "web") {
    return;
  }

  const status = await requestLocationPermission();
  if (status === "granted") {
    await getCurrentLocation();
    return;
  }

  // Permission was not granted - user setting is stale. Disable it server-side
  // so the UI reflects reality and we don't keep prompting.
  try {
    await api.patch("/api/me/", { location_tracking_enabled: false });
  } catch {
    // Best-effort; next bootstrap will retry.
  }
}

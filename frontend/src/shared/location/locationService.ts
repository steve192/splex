import * as Location from "expo-location";
import { Platform } from "react-native";

import { ApiClient } from "../api/client";

let lastLocation: { latitude: number; longitude: number; timestamp: number } | null = null;
const LOCATION_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const LOCATION_REQUEST_TIMEOUT = 8000; // 8s before falling back to last-known

export async function requestLocationPermission(): Promise<"granted" | "denied" | "undetermined"> {
  if (Platform.OS === "web") {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve("denied");
        return;
      }
      // Web doesn't need explicit permission request, it's handled by the browser
      // We just return undetermined and let the browser prompt when needed
      resolve("undetermined");
    });
  }

  const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
  if (existingStatus === Location.PermissionStatus.GRANTED) {
    return "granted";
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status === Location.PermissionStatus.GRANTED) {
    return "granted";
  }
  return status === Location.PermissionStatus.DENIED ? "denied" : "undetermined";
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
    if (!navigator.geolocation) {
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

/**
 * Bootstrap location permission on app startup.
 * If the user has location tracking enabled, request permission (like push notifications).
 * If permission is not granted, disable the server-side setting so UI and reality match.
 */
export async function bootstrapLocationOnStartup(
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

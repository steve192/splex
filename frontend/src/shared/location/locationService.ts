import * as Location from "expo-location";
import { Platform } from "react-native";

let lastLocation: { latitude: number; longitude: number; timestamp: number } | null = null;
const LOCATION_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

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
  if (existingStatus === Location.PermissionStatus.DENIED) {
    return "denied";
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

  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,
      distanceInterval: 10,
    });

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
 * If the user has location tracking enabled and we don't have permission yet,
 * request it. Similar to push notification bootstrap.
 */
export async function bootstrapLocationOnStartup(locationTrackingEnabled: boolean): Promise<void> {
  if (!locationTrackingEnabled) {
    return;
  }

  const enabled = await isLocationEnabled();
  if (enabled) {
    // Already have permission, pre-fetch location
    await getCurrentLocation();
  }
  // Don't auto-request permission. Let user explicitly enable it in settings.
  // The requestLocationPermission will be called when they toggle the setting.
}

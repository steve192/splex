/**
 * Per-device push notification registration.
 *
 * Why this exists: notification routing is per device, not per user. Each install
 * (Expo Go, standalone APK, web/PWA) gets a different push token/subscription.
 * The backend stores all of them under the user; we store *this device's*
 * enable/disable preference in AsyncStorage so toggling on one device doesn't
 * silence the others.
 *
 * Bootstrap flow (called once auth is ready):
 *   - If user has never seen the prompt and the OS permission is already
 *     granted, register silently.
 *   - If the user has explicitly disabled push on this device, do nothing.
 *   - If registration fails (e.g. revoked permission), record the failure so
 *     the Account screen can prompt the user to re-enable.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { ApiClient } from "../api/client";
import { ensureServiceWorkerRegistration } from "../lib/serviceWorker";
import { urlBase64ToArrayBuffer } from "../lib/webPush";

declare const require: (moduleName: string) => unknown;

const LOCAL_PREF_KEY = "splex.push.devicePreference";

export type DevicePushState = {
  preference: "on" | "off" | "unset";
  lastStatus: "registered" | "permission_denied" | "unsupported" | "error" | "idle";
  lastError?: string;
};

export async function getLocalPushPreference(): Promise<DevicePushState["preference"]> {
  const stored = await AsyncStorage.getItem(LOCAL_PREF_KEY);
  if (stored === "on" || stored === "off") return stored;
  return "unset";
}

async function setLocalPushPreference(pref: DevicePushState["preference"]): Promise<void> {
  if (pref === "unset") {
    await AsyncStorage.removeItem(LOCAL_PREF_KEY);
    return;
  }
  await AsyncStorage.setItem(LOCAL_PREF_KEY, pref);
}

function resolveProjectId(): string | undefined {
  const Constants = require("expo-constants") as typeof import("expo-constants");
  const root = (Constants as unknown as { default?: typeof Constants }).default ?? Constants;
  return (
    (root as any).easConfig?.projectId ||
    (root as any).expoConfig?.extra?.eas?.projectId ||
    (root as any).manifest2?.extra?.eas?.projectId ||
    (root as any).manifest?.extra?.eas?.projectId
  );
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  const Notifications = require("expo-notifications") as typeof import("expo-notifications");
  await Notifications.setNotificationChannelAsync("default", {
    name: "Splex",
    importance: Notifications.AndroidImportance.DEFAULT
  });
}

async function registerExpoToken(api: ApiClient, enabled: boolean): Promise<DevicePushState> {
  const Notifications = require("expo-notifications") as typeof import("expo-notifications");

  if (enabled) {
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      return { preference: "off", lastStatus: "permission_denied" };
    }
    await ensureAndroidChannel();
  }

  const projectId = resolveProjectId();
  if (!projectId) {
    throw new Error(
      "Could not find an EAS projectId in app config (extra.eas.projectId). Push tokens cannot be issued."
    );
  }
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.post("/api/notifications/device-tokens/", {
    token: token.data,
    platform: Platform.OS === "ios" ? "ios" : "android",
    enabled
  });
  return { preference: enabled ? "on" : "off", lastStatus: enabled ? "registered" : "idle" };
}

async function registerWebPush(api: ApiClient, enabled: boolean): Promise<DevicePushState> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { preference: "off", lastStatus: "unsupported" };
  }
  const config = await api.get<{ vapid_public_key: string }>("/api/notifications/config/");
  if (!config.vapid_public_key) {
    return { preference: "off", lastStatus: "unsupported" };
  }

  const registration = await ensureServiceWorkerRegistration();
  if (!registration) {
    return { preference: "off", lastStatus: "unsupported" };
  }

  if (enabled) {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { preference: "off", lastStatus: "permission_denied" };
    }
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription && enabled) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(config.vapid_public_key)
    });
  }
  if (!subscription) {
    return { preference: "off", lastStatus: "idle" };
  }

  await api.post("/api/notifications/web-push-subscriptions/", {
    ...subscription.toJSON(),
    enabled
  });
  return { preference: enabled ? "on" : "off", lastStatus: enabled ? "registered" : "idle" };
}

async function registerForPlatform(api: ApiClient, enabled: boolean): Promise<DevicePushState> {
  if (Platform.OS === "android" || Platform.OS === "ios") {
    return registerExpoToken(api, enabled);
  }
  if (Platform.OS === "web") {
    return registerWebPush(api, enabled);
  }
  return { preference: "off", lastStatus: "unsupported" };
}

/** Toggle this device's push state (user-initiated). Persists preference and pushes to backend. */
export async function setDevicePushEnabled(api: ApiClient, enabled: boolean): Promise<DevicePushState> {
  try {
    const result = await registerForPlatform(api, enabled);
    await setLocalPushPreference(result.preference);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[splex:push] registration failed", error);
    return { preference: "off", lastStatus: "error", lastError: message };
  }
}

/** Run once on app startup. Silently re-registers if the user previously opted in. */
export async function bootstrapPushOnStartup(api: ApiClient): Promise<DevicePushState> {
  const preference = await getLocalPushPreference();
  if (preference === "off") {
    return { preference: "off", lastStatus: "idle" };
  }
  // "unset" (first launch) and "on" both attempt registration, but only "unset" should be
  // *silent* - we don't want to surprise the user with a permission prompt on first launch.
  const silent = preference === "unset";
  try {
    if (silent) {
      const already = await hasPermissionAlready();
      if (!already) {
        return { preference: "unset", lastStatus: "idle" };
      }
    }
    const result = await registerForPlatform(api, true);
    await setLocalPushPreference(result.preference);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { preference, lastStatus: "error", lastError: message };
  }
}

async function hasPermissionAlready(): Promise<boolean> {
  if (Platform.OS === "android" || Platform.OS === "ios") {
    const Notifications = require("expo-notifications") as typeof import("expo-notifications");
    const current = await Notifications.getPermissionsAsync();
    return current.granted;
  }
  if (Platform.OS === "web") {
    if (typeof Notification === "undefined") return false;
    return Notification.permission === "granted";
  }
  return false;
}

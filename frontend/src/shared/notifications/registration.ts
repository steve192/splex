/**
 * Per-device push notification registration.
 *
 * Why this exists: notification routing is per device, not per user. Each install
 * (Expo Go, standalone APK, web/PWA) gets a different push token/subscription.
 * The backend stores all of them under the user; we store *this device's*
 * enable/disable preference in AsyncStorage so toggling on one device doesn't
 * silence the others.
 *
 * Lifecycle contract:
 *   - Every app launch with a session re-sends this device's current token /
 *     subscription to the backend. That upload doubles as the liveness
 *     heartbeat: the backend deletes rows not re-registered (and not
 *     successfully delivered to) within PUSH_TOKEN_TTL_DAYS, and a deleted
 *     row is transparently recreated by this re-send on the next launch.
 *   - An explicit "off" via the Account toggle persists across launches: the
 *     token is disabled on the backend and NOT re-sent or re-enabled at
 *     startup. Only a fresh login clears the preference and re-enables push
 *     (resetPushPreferenceOnLogin, called by the auth login flows).
 *   - If the OS permission is still askable, the prompt is shown; if it was
 *     permanently denied, we record that (so the Account screen can offer a
 *     manual re-enable) but do NOT re-prompt on every launch.
 *   - Demo sessions never touch the real push stack.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { ApiClient } from "../api/client";
import { ensureServiceWorkerRegistration } from "../lib/serviceWorker";
import { subscriptionMatchesServerKey, urlBase64ToArrayBuffer } from "../lib/webPush";
import {
  decideStartupPushRegistration,
  PermissionDecision,
  preferenceToPersistAfterStartup,
  PushPreference,
  PushRegistrationStatus
} from "./registrationHelpers";

declare const require: (moduleName: string) => unknown;

const LOCAL_PREF_KEY = "splex.push.devicePreference";

export type DevicePushState = {
  preference: PushPreference;
  lastStatus: PushRegistrationStatus;
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
  if (subscription && !subscriptionMatchesServerKey(subscription, config.vapid_public_key)) {
    // Created under a different VAPID key - the backend can never send to it
    // again. Drop it; the backend's dispatch cleanup removes the stale row.
    await subscription.unsubscribe().catch(() => undefined);
    subscription = null;
  }
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

/**
 * Called on logout: mark this device's push token / web-push subscription as
 * disabled on the backend.  Must be called *before* the auth token is cleared
 * so the request can still authenticate.  Best-effort - never throws.  We only
 * mark the subscription disabled (not deleted): the next login re-registers
 * this same token/subscription and flips it back to enabled.
 */
export async function deregisterPushOnLogout(api: ApiClient): Promise<void> {
  try {
    await registerForPlatform(api, false);
  } catch {
    // Silently ignore: logout must succeed even when the push infrastructure
    // is unavailable (e.g. no network, no EAS projectId in dev builds).
  }
}

/**
 * Called by the auth login flows before the post-login bootstrap runs: a fresh
 * login always re-enables notifications on this device, so any explicit "off"
 * from a previous session is cleared.
 */
export async function resetPushPreferenceOnLogin(): Promise<void> {
  await setLocalPushPreference("unset");
}

/**
 * Re-send this device's push token on app launch; see the file header for the
 * full contract. Skips registration when the user explicitly disabled push on
 * this device or the OS permission is permanently denied.
 */
export async function bootstrapPushOnStartup(api: ApiClient): Promise<DevicePushState> {
  if (api.isDemoMode()) {
    return { preference: "off", lastStatus: "idle" };
  }
  try {
    const decision = decideStartupPushRegistration(
      await getLocalPushPreference(),
      await getPermissionDecision()
    );
    if (decision === "skip_disabled") {
      return { preference: "off", lastStatus: "idle" };
    }
    if (decision === "skip_permission_denied") {
      // OS won't show the prompt again - record it for the Account screen's
      // re-enable button instead of looping a prompt the user can't answer.
      return { preference: "off", lastStatus: "permission_denied" };
    }
    const result = await registerForPlatform(api, true);
    const preferenceToPersist = preferenceToPersistAfterStartup(result.lastStatus);
    if (preferenceToPersist) {
      await setLocalPushPreference(preferenceToPersist);
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[splex:push] login registration failed", error);
    return { preference: "off", lastStatus: "error", lastError: message };
  }
}

/**
 * Current OS notification-permission state, collapsed to three cases.
 * "denied" means the OS will no longer surface the prompt (iOS after the first
 * denial, Android after "don't ask again", web after a block), so callers must
 * not re-prompt; "undetermined" is still askable.
 */
async function getPermissionDecision(): Promise<PermissionDecision> {
  if (Platform.OS === "android" || Platform.OS === "ios") {
    const Notifications = require("expo-notifications") as typeof import("expo-notifications");
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return "granted";
    return current.canAskAgain ? "undetermined" : "denied";
  }
  if (Platform.OS === "web") {
    if (typeof Notification === "undefined") return "denied";
    if (Notification.permission === "granted") return "granted";
    return Notification.permission === "denied" ? "denied" : "undetermined";
  }
  return "denied";
}

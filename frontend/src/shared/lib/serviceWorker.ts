import { Platform } from "react-native";

/**
 * Tracks whether we already initiated a reload triggered by a service-worker
 * controller change. Without this guard, the browser would loop between the old
 * and new controller on first activation.
 */
let reloadingForSwUpdate = false;

/**
 * Register the service worker on web. Used both for push subscription and as a
 * once-per-page-load hook to keep the SW current.
 *
 * - `updateViaCache: 'none'`: bypass the HTTP cache when checking sw.js for
 *   updates, so a new SW deployment reaches the browser on the next page load
 *   instead of waiting up to 24 hours.
 * - `controllerchange` listener: when the activated SW changes (e.g. a fresh
 *   version skipWaiting'd and took control), reload once so the page actually
 *   benefits from the new SW's logic (e.g. no longer intercepting /admin/).
 */
export async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (Platform.OS !== "web") return null;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;

  const hadControllerBefore = !!navigator.serviceWorker.controller;
  if (hadControllerBefore && !controllerChangeListenerAttached) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingForSwUpdate) return;
      reloadingForSwUpdate = true;
      globalThis.location.reload();
    });
    controllerChangeListenerAttached = true;
  }

  const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
  // Trigger an explicit update check on every registration call. The browser
  // does this automatically on navigation, but calling it explicitly speeds up
  // recovery when the user is stuck on a stale cached page.
  registration.update().catch(() => undefined);
  return registration;
}

let controllerChangeListenerAttached = false;

import { Platform } from "react-native";

export async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (Platform.OS !== "web") return null;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js");
}
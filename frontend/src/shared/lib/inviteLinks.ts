import { Platform } from "react-native";

import { BASE_PATH, stripBasePath } from "../config/basePath";

export const PENDING_INVITE_STORAGE_KEY = "splex.pendingInviteToken";

export function inviteDebug(message: string, details?: unknown) {
  if (Platform.OS === "web") {
    console.info(`[splex:invite] ${message}`, details ?? "");
  }
}

export function tokenFromCurrentUrl(paramName = "token"): string {
  if (Platform.OS !== "web" || globalThis.window === undefined) return "";
  const token = new URL(globalThis.window.location.href).searchParams.get(paramName) ?? "";
  inviteDebug("read magic token from url", {
    href: globalThis.window.location.href,
    paramName,
    hasToken: Boolean(token)
  });
  return token;
}

export function inviteTokenFromCurrentUrl(): string {
  if (Platform.OS !== "web" || globalThis.window === undefined) return "";
  const url = new URL(globalThis.window.location.href);
  // The app is served under /app, so strip that prefix before matching the
  // invite route (e.g. "/app/invite/<token>" -> "/invite/<token>").
  const pathMatch = /^\/invite\/([^/?#]+)/.exec(stripBasePath(url.pathname));
  const token = decodeURIComponent(pathMatch?.[1] ?? url.searchParams.get("inviteToken") ?? "");
  inviteDebug("read invite token from url", {
    href: globalThis.window.location.href,
    pathname: url.pathname,
    hasPathToken: Boolean(pathMatch?.[1]),
    hasQueryToken: Boolean(url.searchParams.get("inviteToken")),
    tokenPreview: token ? `${token.slice(0, 6)}...` : ""
  });
  return token;
}

export function clearUrlQuery() {
  if (Platform.OS === "web" && globalThis.window !== undefined) {
    inviteDebug("clearing url", { href: globalThis.window.location.href });
    // Keep the URL inside the app (/app), never bounce to the landing at "/".
    globalThis.window.history.replaceState({}, document.title, `${BASE_PATH}/`);
  }
}

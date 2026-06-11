import { Platform } from "react-native";

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
  const pathMatch = /^\/invite\/([^/?#]+)/.exec(url.pathname);
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
    globalThis.window.history.replaceState({}, document.title, "/");
  }
}

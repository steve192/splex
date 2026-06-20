import { Platform } from "react-native";

import { BASE_PATH, stripBasePath } from "../config/basePath";

export const PENDING_INVITE_STORAGE_KEY = "splex.pendingInviteToken";
const MAGIC_LOGIN_TOKEN_QUERY_PARAM = "token";
const INVITE_TOKEN_QUERY_PARAM = "inviteToken";

export function inviteDebug(message: string, details?: unknown) {
  if (Platform.OS === "web") {
    console.info(`[splex:invite] ${message}`, details ?? "");
  }
}

export function tokenFromCurrentUrl(paramName = "token"): string {
  if (Platform.OS !== "web" || globalThis.window === undefined) return "";
  const token = tokenFromUrl(globalThis.window.location.href, paramName);
  inviteDebug("read magic token from url", {
    href: globalThis.window.location.href,
    paramName,
    hasToken: Boolean(token)
  });
  return token;
}

export function inviteTokenFromCurrentUrl(): string {
  if (Platform.OS !== "web" || globalThis.window === undefined) return "";
  const token = inviteTokenFromUrl(globalThis.window.location.href);
  inviteDebug("read invite token from url", {
    href: globalThis.window.location.href,
    pathname: globalThis.window.location.pathname,
    tokenPreview: token ? `${token.slice(0, 6)}...` : ""
  });
  return token;
}

export function tokenFromUrl(url: string, paramName = MAGIC_LOGIN_TOKEN_QUERY_PARAM): string {
  return parseUrl(url)?.searchParams.get(paramName) ?? "";
}

export function inviteTokenFromUrl(url: string): string {
  const parsed = parseUrl(url);
  if (!parsed) return "";
  const pathToken = /^\/invite\/([^/?#]+)/.exec(stripBasePath(parsed.pathname))?.[1];
  if (pathToken) {
    try {
      return decodeURIComponent(pathToken);
    } catch {
      return pathToken;
    }
  }
  return parsed.searchParams.get(INVITE_TOKEN_QUERY_PARAM) ?? "";
}

function parseUrl(url: string): URL | null {
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function clearUrlQuery() {
  if (Platform.OS === "web" && globalThis.window !== undefined) {
    inviteDebug("clearing url", { href: globalThis.window.location.href });
    // Keep the URL inside the app (/app), never bounce to the landing at "/".
    globalThis.window.history.replaceState({}, document.title, `${BASE_PATH}/`);
  }
}

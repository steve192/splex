/**
 * Demo backend: a flat lookup of canned responses per endpoint.
 *
 * GETs return static fixtures. Writes (POST/PATCH/DELETE), with the exception
 * of harmless metadata writes like /api/me/, throw DemoWriteBlockedError so a
 * snackbar can surface the read-only nature of demo mode.
 */
import { demoFixtures, groupDetail, statisticsForGroup } from "./demoFixtures";
import { DemoWriteBlockedError, notifyDemoWriteBlocked } from "./demoMode";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

function pathOnly(path: string): string {
  const queryIndex = path.indexOf("?");
  return queryIndex === -1 ? path : path.slice(0, queryIndex);
}

function matchInt(part: string): number | null {
  return /^\d+$/.test(part) ? Number(part) : null;
}

export function handleDemoRequest<T>(method: Method, fullPath: string): Promise<T> {
  const path = pathOnly(fullPath);

  if (method === "GET") {
    const result = handleGet(path);
    if (result !== undefined) return Promise.resolve(result as T);
  }

  // Soft-allow no-op endpoints that don't represent user data writes. These
  // get called automatically by app bootstrap and should silently succeed
  // without triggering the "read-only" snackbar.
  if (isSoftAllowedWrite(method, path)) {
    return Promise.resolve(undefined as T);
  }

  if (method === "GET") {
    // GET request that didn't match any fixture - return an empty-ish default
    // rather than blocking. Surfaces "unknown demo endpoint" gracefully.
    return Promise.resolve(undefined as T);
  }

  notifyDemoWriteBlocked();
  return Promise.reject(new DemoWriteBlockedError());
}

function isSoftAllowedWrite(method: Method, path: string): boolean {
  if (method === "POST" && path === "/api/auth/logout/") return true;
  if (method === "POST" && path === "/api/sync/mutations/") return true;
  if (method === "POST" && path === "/api/notifications/device-tokens/") return true;
  if (method === "POST" && path === "/api/notifications/web-push-subscriptions/") return true;
  if (method === "PATCH" && path === "/api/notifications/config/") return true;
  // PATCH /api/me/ - updating local UI preferences (locale, theme, etc.) feels
  // less surprising than blocking. The change is in-memory only for the demo
  // session and resets on the next demo start.
  if (method === "PATCH" && path === "/api/me/") return true;
  return false;
}

const STATIC_GET_RESPONSES: Record<string, () => unknown> = {
  "/api/me/": () => demoFixtures.user,
  "/api/auth/providers/": () => ({
    google: { client_id: null, android_client_id: null },
    demo_mode_enabled: true
  }),
  "/api/overview/": () => demoFixtures.overview,
  "/api/groups/": () => demoFixtures.groupsList,
  "/api/friends/": () => demoFixtures.friendsList,
  "/api/activity/": () => ({ results: demoFixtures.activityEvents, next_offset: null }),
  "/api/currency/rates/": () => ({
    base: "EUR",
    rates: { USD: "1.08", GBP: "0.86", EUR: "1.00" }
  }),
  "/api/notifications/config/": () => ({ web_push_enabled: false, vapid_public_key: "" }),
  "/api/expenses/location-suggestions/": () => ({ suggestions: [] })
};

function handleGroupSubpath(groupId: number, segments: string[]): unknown {
  if (segments.length === 3) return groupDetail(groupId);
  const tail = segments.slice(3).join("/");
  if (tail === "balances") return demoFixtures.balancesByGroup[groupId] ?? [];
  if (tail === "statistics") return statisticsForGroup(groupId);
  if (tail === "expenses") return demoFixtures.expensesByGroup[groupId] ?? [];
  if (tail === "ledger") {
    return { results: demoFixtures.ledgerByGroup[groupId] ?? [], next_offset: null };
  }
  if (segments[3] === "participants" && segments[5] === "outstanding") {
    return demoFixtures.participantOutstandingEmpty;
  }
  return undefined;
}

function handleFriendSubpath(friendId: number, segments: string[]): unknown {
  if (segments.length === 3) return demoFixtures.friendship;
  const tail = segments.slice(3).join("/");
  if (tail === "expenses") return demoFixtures.expensesByFriend[friendId] ?? [];
  if (tail === "ledger") {
    return { results: demoFixtures.ledgerByFriend[friendId] ?? [], next_offset: null };
  }
  if (tail === "statistics") return demoFixtures.statisticsFriend;
  return undefined;
}

function handleGet(path: string): unknown {
  const staticResponse = STATIC_GET_RESPONSES[path];
  if (staticResponse) return staticResponse();

  const segments = path.split("/").filter(Boolean);
  if (segments[0] !== "api") return undefined;
  const resource = segments[1];
  const id = matchInt(segments[2] ?? "");

  if (resource === "groups" && id !== null) return handleGroupSubpath(id, segments);
  if (resource === "friends" && id !== null) return handleFriendSubpath(id, segments);
  if (resource === "expenses" && id !== null) return demoFixtures.expensesById[id];
  if (resource === "settlements" && id !== null) return demoFixtures.settlementsById[id];
  if (resource === "invitations") return { valid: false };

  return undefined;
}

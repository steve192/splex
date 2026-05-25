import AsyncStorage from "@react-native-async-storage/async-storage";

import { ApiClient, ApiError } from "../api/client";

const HTTP_CACHE_PREFIX = "splex.cache.http.";

function cacheKey(path: string): string {
  return `${HTTP_CACHE_PREFIX}${path}`;
}

/**
 * Wraps `api.get(path)` with a URL-keyed cache. On a successful response the
 * payload is persisted; on network/offline failure the most recent cached
 * payload is returned. Any non-offline error (HTTP 4xx/5xx, parse errors, etc.)
 * is rethrown so authentication issues and server errors are not masked by
 * stale data.
 *
 * Use one shared cache across screens so visiting any screen that loads a
 * resource (e.g. `/api/groups/{id}/`) makes that resource available offline to
 * every other screen that needs it.
 */
export async function cachedGet<T>(api: ApiClient, path: string): Promise<T> {
  try {
    const data = await api.get<T>(path);
    await AsyncStorage.setItem(cacheKey(path), JSON.stringify(data));
    return data;
  } catch (error) {
    if (!(error instanceof ApiError) || !error.offline) {
      throw error;
    }
    const raw = await AsyncStorage.getItem(cacheKey(path));
    if (raw !== null) {
      return JSON.parse(raw) as T;
    }
    throw error;
  }
}

/**
 * Reads a previously cached response without making a network request. Returns
 * `null` if the resource has not been fetched (and cached) yet.
 */
export async function readCachedResponse<T>(path: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(cacheKey(path));
  return raw ? (JSON.parse(raw) as T) : null;
}

/**
 * Best-effort cache priming. Fires each GET in the background; failures
 * (offline, auth, etc.) are swallowed so bootstrap continues regardless.
 */
export async function prefetchPaths(api: ApiClient, paths: string[]): Promise<void> {
  await Promise.all(
    paths.map((path) =>
      cachedGet(api, path).catch(() => undefined)
    )
  );
}

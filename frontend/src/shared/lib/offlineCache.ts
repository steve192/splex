import AsyncStorage from "@react-native-async-storage/async-storage";

import { ApiClient, ApiError } from "../api/client";

const HTTP_CACHE_PREFIX = "splex.cache.http.";

export type CachedGetOptions<T> = {
  onBackgroundRefreshEnd?: () => void;
  onBackgroundRefreshStart?: () => void;
  onFreshData?: (data: T) => void | Promise<void>;
};

function cacheKey(path: string): string {
  return `${HTTP_CACHE_PREFIX}${path}`;
}

async function getAndCache<T>(api: ApiClient, path: string): Promise<T> {
  const data = await api.get<T>(path);
  return writeCachedResponse(path, data);
}

export async function writeCachedResponse<T>(path: string, data: T): Promise<T> {
  await AsyncStorage.setItem(cacheKey(path), JSON.stringify(data));
  return data;
}

/**
 * Wraps `api.get(path)` with a URL-keyed cache. On a successful response the
 * payload is persisted. If a cached payload exists, it is returned immediately
 * and the network refresh continues in the background. Callers that need the
 * eventual fresh payload can pass `onFreshData`.
 *
 * Use one shared cache across screens so visiting any screen that loads a
 * resource (e.g. `/api/groups/{id}/`) makes that resource available offline to
 * every other screen that needs it.
 */
export async function cachedGet<T>(
  api: ApiClient,
  path: string,
  options: CachedGetOptions<T> = {}
): Promise<T> {
  const raw = await AsyncStorage.getItem(cacheKey(path));
  if (raw !== null) {
    const cached = JSON.parse(raw) as T;
    options.onBackgroundRefreshStart?.();
    getAndCache<T>(api, path)
      .then((data) => {
        void options.onFreshData?.(data);
      })
      .catch(() => undefined)
      .finally(() => {
        options.onBackgroundRefreshEnd?.();
      });
    return cached;
  }

  try {
    return await getAndCache<T>(api, path);
  } catch (error) {
    if (!(error instanceof ApiError) || !error.offline) {
      throw error;
    }
    throw error;
  }
}

/**
 * Forces a network read and updates the shared cache with the fresh payload.
 * Use this after successful mutations, where showing a stale cached response
 * would make the write look like it was lost.
 */
export async function refreshCachedGet<T>(api: ApiClient, path: string): Promise<T> {
  return getAndCache<T>(api, path);
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

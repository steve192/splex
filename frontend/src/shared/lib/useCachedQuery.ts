import { useCallback, useMemo, useState } from "react";

import type { ApiClient } from "../api/client";
import {
  cachedQueryLoading,
  cachedQueryLoadingInitial,
  cachedQueryRefreshCountAfterDelta
} from "./cachedQueryState";
import { cachedGet, readCachedResponse, refreshCachedGet, type CachedGetOptions } from "./offlineCache";

type CachedQueryGetOptions<T> = Omit<
  CachedGetOptions<T>,
  "onBackgroundRefreshEnd" | "onBackgroundRefreshStart"
>;

export type CachedQueryHelpers = {
  cachedGet<T>(api: ApiClient, path: string, options?: CachedQueryGetOptions<T>): Promise<T>;
};

type UseCachedQueryOptions<T> = {
  initialData?: T | null;
  load: (helpers: CachedQueryHelpers) => Promise<T>;
};

export function useCachedQuery<T>({
  initialData = null,
  load
}: UseCachedQueryOptions<T>) {
  const [data, setData] = useState<T | null>(initialData);
  const [error, setError] = useState<unknown>(null);
  const [foregroundLoading, setForegroundLoading] = useState(false);
  const [backgroundRefreshes, setBackgroundRefreshes] = useState(0);

  const beginBackgroundRefresh = useCallback(() => {
    setBackgroundRefreshes((current) => cachedQueryRefreshCountAfterDelta(current, 1));
  }, []);

  const endBackgroundRefresh = useCallback(() => {
    setBackgroundRefreshes((current) => cachedQueryRefreshCountAfterDelta(current, -1));
  }, []);

  const cachedOnlyGet = useCallback(
    async <Value,>(api: ApiClient, path: string) => {
      const cached = await readCachedResponse<Value>(path);
      return cached ?? refreshCachedGet<Value>(api, path);
    },
    []
  );

  const recomputeFromCache = useCallback(async () => {
    try {
      const next = await load({ cachedGet: cachedOnlyGet });
      setData(next);
      setError(null);
    } catch (error_) {
      setError(error_);
    }
  }, [cachedOnlyGet, load]);

  const trackedCachedGet = useCallback(
    <Value,>(api: ApiClient, path: string, options: CachedQueryGetOptions<Value> = {}) =>
      cachedGet<Value>(api, path, {
        ...options,
        onBackgroundRefreshEnd: endBackgroundRefresh,
        onBackgroundRefreshStart: beginBackgroundRefresh,
        onFreshData: async (data) => {
          await options.onFreshData?.(data);
          await recomputeFromCache();
        }
      }),
    [beginBackgroundRefresh, endBackgroundRefresh, recomputeFromCache]
  );

  const freshCachedGet = useCallback(
    async <Value,>(api: ApiClient, path: string, options: CachedQueryGetOptions<Value> = {}) => {
      const data = await refreshCachedGet<Value>(api, path);
      await options.onFreshData?.(data);
      return data;
    },
    []
  );

  const runLoad = useCallback(async (helpers: CachedQueryHelpers) => {
    setForegroundLoading(true);
    setError(null);
    try {
      const next = await load(helpers);
      setData(next);
      return next;
    } catch (error_) {
      setError(error_);
      throw error_;
    } finally {
      setForegroundLoading(false);
    }
  }, [load]);

  const reload = useCallback(() => runLoad({ cachedGet: trackedCachedGet }), [runLoad, trackedCachedGet]);

  const reloadFresh = useCallback(() => runLoad({ cachedGet: freshCachedGet }), [freshCachedGet, runLoad]);

  const loading = cachedQueryLoading({ foregroundLoading, backgroundRefreshes });
  const loadingInitial = cachedQueryLoadingInitial({ hasData: data !== null, loading });

  return useMemo(
    () => ({
      data,
      error,
      loading,
      loadingInitial,
      reload,
      reloadFresh
    }),
    [data, error, loading, loadingInitial, reload, reloadFresh]
  );
}

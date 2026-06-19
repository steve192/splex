import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cachedQueryRefreshCountAfterDelta } from "./cachedQueryState";

export type FeedPage<T> = { items: T[]; nextOffset: number | null };

export type FetchFeedPage<T> = (params: {
  offset: number;
  limit: number;
  search: string;
  /** True only for the unfiltered first page, where the offline cache may serve. */
  cacheable: boolean;
  /**
   * Called when a cacheable request returned stale data first and fresh data
   * arrived later. The hook applies the page without another full reload.
   */
  onFreshPage?: (page: FeedPage<T>) => void;
  onBackgroundRefreshEnd?: () => void;
  onBackgroundRefreshStart?: () => void;
}) => Promise<FeedPage<T>>;

type Options<T> = {
  pageSize: number;
  /** Debounced search term; changing it reloads the first page. */
  searchTerm: string;
  fetchPage: FetchFeedPage<T>;
  /**
   * Optional transform applied to the full result set of the first page (e.g.
   * to prepend local drafts). Only runs for the unfiltered first page — never
   * while searching or appending further pages.
   */
  mapInitial?: (items: T[]) => Promise<T[]> | T[];
};

export function loadedCountAfterPage({
  offset,
  currentLoadedCount,
  pageItemCount
}: {
  offset: number;
  currentLoadedCount: number;
  pageItemCount: number;
}): number {
  return offset ? currentLoadedCount + pageItemCount : pageItemCount;
}

export function refreshOffsets(loadedCount: number, pageSize: number): number[] {
  const pageCount = Math.max(1, Math.ceil(loadedCount / pageSize));
  return Array.from({ length: pageCount }, (_unused, index) => index * pageSize);
}

export function itemsAfterPage<T>({
  currentItems,
  pageItems,
  offset,
  replaceOffset
}: {
  currentItems: T[];
  pageItems: T[];
  offset: number;
  replaceOffset: boolean;
}): T[] {
  if (!offset) return pageItems;
  return replaceOffset
    ? [...currentItems.slice(0, offset), ...pageItems, ...currentItems.slice(offset + pageItems.length)]
    : [...currentItems, ...pageItems];
}

export type PaginatedFeed<T> = {
  items: T[];
  nextOffset: number | null;
  loadingInitial: boolean;
  loadingMore: boolean;
  /** Loads a page: offset 0 replaces the list, a positive offset appends. */
  load: (offset?: number) => Promise<void>;
  /**
   * Refetches every currently-shown item in page-sized chunks so returning to
   * the screen does not collapse the list and lose the scroll position.
   */
  refresh: () => Promise<void>;
};

/**
 * Offset-paginated list with infinite scroll, search and scroll-preserving
 * refresh. The list endpoint is supplied via {@link FetchFeedPage}; this hook
 * owns the items, pagination cursor and loading flag so each screen does not
 * reimplement the same fetch/append/refresh dance.
 */
export function usePaginatedFeed<T>({
  pageSize,
  searchTerm,
  fetchPage,
  mapInitial
}: Options<T>): PaginatedFeed<T> {
  const [items, setItems] = useState<T[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [backgroundRefreshes, setBackgroundRefreshes] = useState(0);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Number of fetched items currently shown (excluding any prepended drafts) so
  // a refresh can refetch the same amount in deterministic page-sized chunks.
  const loadedCount = useRef(0);
  const termRef = useRef(searchTerm);
  termRef.current = searchTerm;
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const mapInitialRef = useRef(mapInitial);
  mapInitialRef.current = mapInitial;
  const pageSizeRef = useRef(pageSize);
  pageSizeRef.current = pageSize;
  const loadingMoreRef = useRef(false);
  const settled = useRef(false);

  const withDrafts = useCallback((results: T[], term: string): Promise<T[]> | T[] => {
    return mapInitialRef.current && !term ? mapInitialRef.current(results) : results;
  }, []);

  const beginBackgroundRefresh = useCallback(() => {
    setBackgroundRefreshes((current) => cachedQueryRefreshCountAfterDelta(current, 1));
  }, []);

  const endBackgroundRefresh = useCallback(() => {
    setBackgroundRefreshes((current) => cachedQueryRefreshCountAfterDelta(current, -1));
  }, []);

  const applyPage = useCallback(
    async (page: FeedPage<T>, offset: number, term: string, replaceOffset = false) => {
      if (offset) {
        setItems((current) => {
          loadedCount.current = loadedCountAfterPage({
            offset,
            currentLoadedCount: loadedCount.current,
            pageItemCount: page.items.length
          });
          return itemsAfterPage({
            currentItems: current,
            pageItems: page.items,
            offset,
            replaceOffset
          });
        });
      } else {
        setItems(await withDrafts(page.items, term));
        loadedCount.current = loadedCountAfterPage({
          offset,
          currentLoadedCount: loadedCount.current,
          pageItemCount: page.items.length
        });
      }
      setNextOffset(page.nextOffset);
    },
    [withDrafts]
  );

  const load = useCallback(async (offset = 0) => {
    if (offset && loadingMoreRef.current) return;
    if (offset) {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    } else {
      setLoadingInitial(true);
    }
    try {
      const term = termRef.current;
      const page = await fetchPageRef.current({
        offset,
        limit: pageSizeRef.current,
        search: term,
        cacheable: !offset && !term,
        onFreshPage: (freshPage) => {
          if (termRef.current === term) {
            void applyPage(freshPage, offset, term, true);
          }
        },
        onBackgroundRefreshEnd: endBackgroundRefresh,
        onBackgroundRefreshStart: beginBackgroundRefresh
      });
      await applyPage(page, offset, term);
    } finally {
      if (offset) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      } else {
        setLoadingInitial(false);
      }
    }
  }, [applyPage, beginBackgroundRefresh, endBackgroundRefresh]);

  const refresh = useCallback(async () => {
    setLoadingInitial(true);
    const term = termRef.current;
    try {
      const pages = await Promise.all(
        refreshOffsets(loadedCount.current, pageSizeRef.current).map((offset) =>
          fetchPageRef.current({
            offset,
            limit: pageSizeRef.current,
            search: term,
            cacheable: offset === 0 && !term,
            onFreshPage: (freshPage) => {
              if (termRef.current === term) {
                void applyPage(freshPage, offset, term, true);
              }
            },
            onBackgroundRefreshEnd: endBackgroundRefresh,
            onBackgroundRefreshStart: beginBackgroundRefresh
          })
        )
      );
      const results = pages.flatMap((page) => page.items);
      setItems(await withDrafts(results, term));
      loadedCount.current = results.length;
      setNextOffset(pages.at(-1)?.nextOffset ?? null);
    } finally {
      setLoadingInitial(false);
    }
  }, [applyPage, beginBackgroundRefresh, endBackgroundRefresh, withDrafts]);

  // Reload the first page whenever the committed term changes, skipping the
  // initial value so it does not race the screen's focus-effect first load.
  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    load(0).catch(() => undefined);
  }, [load, searchTerm]);

  return useMemo(
    () => ({ items, nextOffset, loadingInitial: loadingInitial || backgroundRefreshes > 0, loadingMore, load, refresh }),
    [items, nextOffset, loadingInitial, backgroundRefreshes, loadingMore, load, refresh]
  );
}

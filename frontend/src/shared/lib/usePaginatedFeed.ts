import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cachedQueryRefreshCountAfterDelta } from "./cachedQueryState";

export type FeedPage<T> = { items: T[]; nextOffset: number | null };

export type FetchFeedPage<T> = (params: {
  offset: number;
  limit: number;
  search: string;
  /** True for unfiltered pages where the offline cache may serve. */
  cacheable: boolean;
  /**
   * Called when a cacheable request returned stale data first and fresh data
   * arrived later. The hook decides whether the fresh page can be applied
   * without mixing incompatible offset snapshots.
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

export function refreshOffsets(loadedCount: number, pageSize: number): number[] {
  const pageCount = Math.max(1, Math.ceil(loadedCount / pageSize));
  return Array.from({ length: pageCount }, (_unused, index) => index * pageSize);
}

export function isCacheableFeedPage({
  search
}: {
  search: string;
}): boolean {
  return !search;
}

export function orderedPageOffsets<T>(pages: ReadonlyMap<number, FeedPage<T>>): number[] {
  return [...pages.keys()].sort((left, right) => left - right);
}

export function itemsFromPages<T>(pages: ReadonlyMap<number, FeedPage<T>>): T[] {
  return orderedPageOffsets(pages).flatMap((offset) => pages.get(offset)?.items ?? []);
}

export function nextOffsetFromPages<T>(pages: ReadonlyMap<number, FeedPage<T>>): number | null {
  const highestOffset = orderedPageOffsets(pages).at(-1);
  return highestOffset === undefined ? null : pages.get(highestOffset)?.nextOffset ?? null;
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
  const pagesRef = useRef<Map<number, FeedPage<T>>>(new Map());
  const refreshBatchId = useRef(0);
  const refreshBatch = useRef<{
    id: number;
    term: string;
    offsets: number[];
    pages: Map<number, FeedPage<T>>;
    ready: boolean;
  } | null>(null);

  const withDrafts = useCallback((results: T[], term: string): Promise<T[]> | T[] => {
    return mapInitialRef.current && !term ? mapInitialRef.current(results) : results;
  }, []);

  const beginBackgroundRefresh = useCallback(() => {
    setBackgroundRefreshes((current) => cachedQueryRefreshCountAfterDelta(current, 1));
  }, []);

  const endBackgroundRefresh = useCallback(() => {
    setBackgroundRefreshes((current) => cachedQueryRefreshCountAfterDelta(current, -1));
  }, []);

  const publishPages = useCallback(
    async (pages: Map<number, FeedPage<T>>, term: string) => {
      const results = itemsFromPages(pages);
      const displayedItems = await withDrafts(results, term);
      if (termRef.current !== term) return;
      setItems(displayedItems);
      loadedCount.current = results.length;
      setNextOffset(nextOffsetFromPages(pages));
    },
    [withDrafts]
  );

  const applyPages = useCallback(
    async (pages: Map<number, FeedPage<T>>, term: string) => {
      pagesRef.current = pages;
      await publishPages(pages, term);
    },
    [publishPages]
  );

  const applyPage = useCallback(
    async (page: FeedPage<T>, offset: number, term: string, replace: boolean) => {
      const pages = replace ? new Map<number, FeedPage<T>>() : new Map(pagesRef.current);
      pages.set(offset, page);
      await applyPages(pages, term);
    },
    [applyPages]
  );

  const applyRefreshBatchIfComplete = useCallback(
    (id: number) => {
      const batch = refreshBatch.current;
      if (!batch || batch.id !== id || !batch.ready || termRef.current !== batch.term) return;
      if (batch.pages.size !== batch.offsets.length) return;
      const pages = new Map<number, FeedPage<T>>();
      for (const offset of batch.offsets) {
        const page = batch.pages.get(offset);
        if (!page) return;
        pages.set(offset, page);
      }
      refreshBatch.current = null;
      void applyPages(pages, batch.term);
    },
    [applyPages]
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
        cacheable: isCacheableFeedPage({ search: term }),
        onFreshPage: offset
          ? undefined
          : (freshPage) => {
              if (termRef.current === term) {
                void applyPage(freshPage, offset, term, true);
              }
            },
        onBackgroundRefreshEnd: endBackgroundRefresh,
        onBackgroundRefreshStart: beginBackgroundRefresh
      });
      await applyPage(page, offset, term, offset === 0);
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
    const loadedBeforeRefresh = loadedCount.current;
    const offsets = refreshOffsets(loadedBeforeRefresh, pageSizeRef.current);
    const cacheable = isCacheableFeedPage({ search: term });
    const batchId = cacheable ? refreshBatchId.current + 1 : null;
    if (batchId !== null) {
      refreshBatchId.current = batchId;
      refreshBatch.current = {
        id: batchId,
        term,
        offsets,
        pages: new Map(),
        ready: false
      };
    }
    try {
      const pages = await Promise.all(
        offsets.map((offset) =>
          fetchPageRef.current({
            offset,
            limit: pageSizeRef.current,
            search: term,
            cacheable,
            onFreshPage: batchId !== null
              ? (freshPage) => {
                  const batch = refreshBatch.current;
                  if (!batch || batch.id !== batchId || batch.term !== term) return;
                  batch.pages.set(offset, freshPage);
                  applyRefreshBatchIfComplete(batchId);
                }
              : undefined,
            onBackgroundRefreshEnd: endBackgroundRefresh,
            onBackgroundRefreshStart: beginBackgroundRefresh
          })
        )
      );
      const pageMap = new Map<number, FeedPage<T>>();
      offsets.forEach((offset, index) => {
        pageMap.set(offset, pages[index]);
      });
      await applyPages(pageMap, term);
      if (batchId !== null && refreshBatch.current?.id === batchId) {
        refreshBatch.current.ready = true;
        applyRefreshBatchIfComplete(batchId);
      }
    } finally {
      setLoadingInitial(false);
    }
  }, [applyPages, applyRefreshBatchIfComplete, beginBackgroundRefresh, endBackgroundRefresh]);

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

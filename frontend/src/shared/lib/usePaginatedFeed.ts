import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type FeedPage<T> = { items: T[]; nextOffset: number | null };

export type FetchFeedPage<T> = (params: {
  offset: number;
  limit: number;
  search: string;
  /** True only for the unfiltered first page, where the offline cache may serve. */
  cacheable: boolean;
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

export type PaginatedFeed<T> = {
  items: T[];
  nextOffset: number | null;
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

  const load = useCallback(async (offset = 0) => {
    if (offset && loadingMoreRef.current) return;
    if (offset) {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }
    try {
      const term = termRef.current;
      const page = await fetchPageRef.current({
        offset,
        limit: pageSizeRef.current,
        search: term,
        cacheable: !offset && !term
      });
      if (offset) {
        setItems((current) => {
          loadedCount.current = loadedCountAfterPage({
            offset,
            currentLoadedCount: loadedCount.current,
            pageItemCount: page.items.length
          });
          return [...current, ...page.items];
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
    } finally {
      if (offset) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [withDrafts]);

  const refresh = useCallback(async () => {
    const term = termRef.current;
    const pages = await Promise.all(
      refreshOffsets(loadedCount.current, pageSizeRef.current).map((offset) =>
        fetchPageRef.current({
          offset,
          limit: pageSizeRef.current,
          search: term,
          cacheable: offset === 0 && !term
        })
      )
    );
    const results = pages.flatMap((page) => page.items);
    setItems(await withDrafts(results, term));
    loadedCount.current = results.length;
    setNextOffset(pages.at(-1)?.nextOffset ?? null);
  }, [withDrafts]);

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
    () => ({ items, nextOffset, loadingMore, load, refresh }),
    [items, nextOffset, loadingMore, load, refresh]
  );
}

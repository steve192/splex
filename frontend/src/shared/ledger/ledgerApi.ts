import type { ApiClient } from "../api/client";
import { cachedGet } from "../lib/offlineCache";
import { FeedPage } from "../lib/usePaginatedFeed";
import { LedgerItem } from "../types/models";

export const LEDGER_PAGE_SIZE = 30;

type LedgerPageParams = {
  offset: number;
  limit: number;
  search: string;
  cacheable: boolean;
  onBackgroundRefreshEnd?: () => void;
  onBackgroundRefreshStart?: () => void;
  onFreshPage?: (page: FeedPage<LedgerItem>) => void;
};

/**
 * Fetches one page of a group or friend ledger. Search results bypass the
 * offline cache so stale matches are not persisted; the unfiltered first page
 * stays cached for offline use.
 */
export async function fetchLedgerPage(
  api: ApiClient,
  resource: "groups" | "friends",
  id: number,
  { offset, limit, search, cacheable, onBackgroundRefreshEnd, onBackgroundRefreshStart, onFreshPage }: LedgerPageParams
): Promise<FeedPage<LedgerItem>> {
  const searchQuery = search ? `&search=${encodeURIComponent(search)}` : "";
  const path = `/api/${resource}/${id}/ledger/?offset=${offset}&limit=${limit}${searchQuery}`;
  const response = cacheable
    ? await cachedGet<{ results: LedgerItem[]; next_offset: number | null }>(api, path, {
        onBackgroundRefreshEnd,
        onBackgroundRefreshStart,
        onFreshData: (data) => onFreshPage?.({ items: data.results, nextOffset: data.next_offset })
      })
    : await api.get<{ results: LedgerItem[]; next_offset: number | null }>(path);
  return { items: response.results, nextOffset: response.next_offset };
}

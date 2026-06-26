import type { ApiClient } from "../api/client";
import { readCachedResponse, refreshCachedGet } from "../lib/offlineCache";

export const CURRENCY_RATES_PATH = "/api/currency/rates/";
const CURRENCY_RATES_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type CurrencyRatesSnapshot = {
  base_currency: string;
  rates: Record<string, string>;
  source: string;
  fetched_at: string;
};

type LoadCurrencyRatesOptions = {
  force?: boolean;
  now?: number;
  onCached?: (snapshot: CurrencyRatesSnapshot) => void;
};

export type CurrencyRatesLoadResult = {
  snapshot: CurrencyRatesSnapshot | null;
  refreshFailed: boolean;
};

export function currencyRatesAreStale(
  snapshot: CurrencyRatesSnapshot,
  now = Date.now(),
): boolean {
  const fetchedAtMs = new Date(snapshot.fetched_at).getTime();
  return !Number.isFinite(fetchedAtMs) || now - fetchedAtMs > CURRENCY_RATES_MAX_AGE_MS;
}

export async function loadCurrencyRates(
  api: ApiClient,
  { force = false, now = Date.now(), onCached }: LoadCurrencyRatesOptions = {},
): Promise<CurrencyRatesLoadResult> {
  const cached = await readCachedResponse<CurrencyRatesSnapshot>(CURRENCY_RATES_PATH);
  if (cached) onCached?.(cached);
  if (cached && !force && !currencyRatesAreStale(cached, now)) {
    return { snapshot: cached, refreshFailed: false };
  }

  try {
    const snapshot = await refreshCachedGet<CurrencyRatesSnapshot>(api, CURRENCY_RATES_PATH);
    return { snapshot, refreshFailed: false };
  } catch {
    return { snapshot: cached, refreshFailed: true };
  }
}

/**
 * Refreshes the server snapshot on app launch only when the locally cached
 * snapshot is missing or older than one day.
 */
export async function bootstrapCurrencyRates(api: ApiClient): Promise<void> {
  await loadCurrencyRates(api);
}

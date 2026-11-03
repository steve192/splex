import type { ApiClient } from "../api/client";
import { readCachedResponse, refreshCachedGet } from "../lib/offlineCache";

export const CURRENCY_RATES_PATH = "/api/currency/rates/";
export const CURRENCY_RATE_PATH = "/api/currency/rate/";
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

export type CurrencyRate = {
  base_currency: string;
  quote_currency: string;
  rate: string;
  rate_date: string | null;
  source: string;
};

type CurrencyRateQuery = Readonly<{
  baseCurrency: string;
  quoteCurrency: string;
  /** Omitted means today, matching expenses saved without a date. */
  date?: string;
}>;

export function currencyRatePath({
  baseCurrency,
  quoteCurrency,
  date,
}: CurrencyRateQuery): string {
  const params = new URLSearchParams();
  params.set("base_currency", baseCurrency);
  params.set("quote_currency", quoteCurrency);
  if (date) params.set("date", date);
  return `${CURRENCY_RATE_PATH}?${params.toString()}`;
}

/**
 * The official rate the backend applies to an expense on the given date. Fresh
 * when online, so "today" never comes from an older cached day; cached offline.
 */
export async function loadCurrencyRate(
  api: ApiClient,
  query: CurrencyRateQuery,
): Promise<CurrencyRate> {
  const path = currencyRatePath(query);
  try {
    return await refreshCachedGet<CurrencyRate>(api, path);
  } catch (error) {
    const cached = await readCachedResponse<CurrencyRate>(path);
    if (cached) return cached;
    throw error;
  }
}

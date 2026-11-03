import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CURRENCY_RATES_PATH,
  bootstrapCurrencyRates,
  currencyRatePath,
  currencyRatesAreStale,
  loadCurrencyRate,
  loadCurrencyRates,
} from "./rates";

const { readCachedResponse, refreshCachedGet } = vi.hoisted(() => ({
  readCachedResponse: vi.fn(),
  refreshCachedGet: vi.fn(),
}));

vi.mock("../lib/offlineCache", () => ({ readCachedResponse, refreshCachedGet }));

const freshSnapshot = {
  base_currency: "EUR",
  rates: { EUR: "1", USD: "1.08" },
  source: "frankfurter",
  fetched_at: "2026-06-26T12:00:00.000Z",
};

describe("loadCurrencyRates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses a cached snapshot until it is more than one day old", async () => {
    const api = {};
    const onCached = vi.fn();
    readCachedResponse.mockResolvedValueOnce(freshSnapshot);

    const result = await loadCurrencyRates(api as never, {
      now: Date.parse("2026-06-27T12:00:00.000Z"),
      onCached,
    });

    expect(result).toEqual({ snapshot: freshSnapshot, refreshFailed: false });
    expect(onCached).toHaveBeenCalledWith(freshSnapshot);
    expect(refreshCachedGet).not.toHaveBeenCalled();
  });

  it("refreshes stale or missing snapshots and keeps stale data on failure", async () => {
    const api = {};
    readCachedResponse.mockResolvedValueOnce(freshSnapshot);
    refreshCachedGet.mockRejectedValueOnce(new Error("offline"));

    const result = await loadCurrencyRates(api as never, {
      now: Date.parse("2026-06-27T12:00:00.001Z"),
    });

    expect(result).toEqual({ snapshot: freshSnapshot, refreshFailed: true });
    expect(refreshCachedGet).toHaveBeenCalledWith(api, CURRENCY_RATES_PATH);
  });

  it("returns an empty offline state when no snapshot has ever been cached", async () => {
    const api = {};
    readCachedResponse.mockResolvedValueOnce(null);
    refreshCachedGet.mockRejectedValueOnce(new Error("offline"));

    const result = await loadCurrencyRates(api as never);

    expect(result).toEqual({ snapshot: null, refreshFailed: true });
    expect(refreshCachedGet).toHaveBeenCalledWith(api, CURRENCY_RATES_PATH);
  });

  it("forces a backend fetch even while the cached snapshot is fresh", async () => {
    const api = {};
    readCachedResponse.mockResolvedValueOnce(freshSnapshot);
    refreshCachedGet.mockResolvedValueOnce(freshSnapshot);

    await loadCurrencyRates(api as never, { force: true });

    expect(refreshCachedGet).toHaveBeenCalledWith(api, CURRENCY_RATES_PATH);
  });

  it("marks invalid or older-than-one-day timestamps as stale", () => {
    expect(
      currencyRatesAreStale(freshSnapshot, Date.parse("2026-06-27T12:00:00.000Z")),
    ).toBe(false);
    expect(
      currencyRatesAreStale(freshSnapshot, Date.parse("2026-06-27T12:00:00.001Z")),
    ).toBe(true);
    expect(currencyRatesAreStale({ ...freshSnapshot, fetched_at: "invalid" })).toBe(true);
  });

  it("applies the same cache-age policy during app startup", async () => {
    readCachedResponse.mockResolvedValueOnce({
      ...freshSnapshot,
      fetched_at: new Date().toISOString(),
    });

    await bootstrapCurrencyRates({} as never);

    expect(refreshCachedGet).not.toHaveBeenCalled();
  });
});

describe("loadCurrencyRate", () => {
  const ratePath =
    "/api/currency/rate/?base_currency=NOK&quote_currency=EUR&date=2026-11-02";
  const query = {
    baseCurrency: "NOK",
    quoteCurrency: "EUR",
    date: "2026-11-02",
  } as const;
  const rate = {
    base_currency: "NOK",
    quote_currency: "EUR",
    rate: "0.08570000",
    rate_date: "2026-11-02",
    source: "frankfurter",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds the dated rate path and omits the date for today", () => {
    expect(currencyRatePath(query)).toBe(ratePath);
    expect(currencyRatePath({ baseCurrency: "NOK", quoteCurrency: "EUR" })).toBe(
      "/api/currency/rate/?base_currency=NOK&quote_currency=EUR",
    );
  });

  it("prefers a fresh rate over the cached one", async () => {
    refreshCachedGet.mockResolvedValueOnce(rate);

    await expect(loadCurrencyRate({} as never, query)).resolves.toEqual(rate);
    expect(refreshCachedGet).toHaveBeenCalledWith({}, ratePath);
    expect(readCachedResponse).not.toHaveBeenCalled();
  });

  it("falls back to the cached rate offline", async () => {
    refreshCachedGet.mockRejectedValueOnce(new Error("offline"));
    readCachedResponse.mockResolvedValueOnce(rate);

    await expect(loadCurrencyRate({} as never, query)).resolves.toEqual(rate);
    expect(readCachedResponse).toHaveBeenCalledWith(ratePath);
  });

  it("fails when offline without a cached rate", async () => {
    refreshCachedGet.mockRejectedValueOnce(new Error("offline"));
    readCachedResponse.mockResolvedValueOnce(null);

    await expect(loadCurrencyRate({} as never, query)).rejects.toThrow("offline");
  });
});

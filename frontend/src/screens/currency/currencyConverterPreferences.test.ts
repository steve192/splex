import { beforeEach, describe, expect, it, vi } from "vitest";

const store: Record<string, string> = {};

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    async getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key)
        ? store[key]
        : null;
    },
    async setItem(key: string, value: string) {
      store[key] = value;
    },
  },
}));

import {
  loadCurrencyConverterCurrencyPair,
  saveCurrencyConverterCurrencyPair,
} from "./currencyConverterPreferences";

const storageKey = "splex.currencyConverter.currencyPair";

describe("currency converter preferences", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
  });

  it("returns null when no currency pair was saved", async () => {
    expect(await loadCurrencyConverterCurrencyPair()).toBeNull();
  });

  it("persists the last selected currency pair", async () => {
    await saveCurrencyConverterCurrencyPair({
      fromCurrency: "GBP",
      toCurrency: "JPY",
    });

    expect(await loadCurrencyConverterCurrencyPair()).toEqual({
      fromCurrency: "GBP",
      toCurrency: "JPY",
    });
  });

  it("ignores malformed or unsupported stored currency pairs", async () => {
    store[storageKey] = JSON.stringify({
      fromCurrency: "EUR",
      toCurrency: "ABC",
    });
    expect(await loadCurrencyConverterCurrencyPair()).toBeNull();

    store[storageKey] = "{not json";
    expect(await loadCurrencyConverterCurrencyPair()).toBeNull();
  });
});

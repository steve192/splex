import { describe, expect, it } from "vitest";

import { CURRENCY_RATES_COMPACT_WIDTH, shouldStackCurrencyRatesInfo } from "./currencyConverterLayout";

describe("shouldStackCurrencyRatesInfo", () => {
  it("stacks the timestamp and refresh button on narrow screens", () => {
    expect(shouldStackCurrencyRatesInfo(CURRENCY_RATES_COMPACT_WIDTH - 1)).toBe(true);
    expect(shouldStackCurrencyRatesInfo(CURRENCY_RATES_COMPACT_WIDTH)).toBe(false);
  });
});

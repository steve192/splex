import { describe, expect, it } from "vitest";

import {
  COMMON_CONVERSION_AMOUNTS,
  commonConversionRows,
  conversionRate,
  convertedAmount,
} from "./currencyConverterModel";

const rates = { EUR: "1", USD: "1.08", GBP: "0.86" };

describe("currency converter model", () => {
  it("converts through the snapshot base currency", () => {
    expect(convertedAmount("100", "USD", "GBP", rates)).toBeCloseTo(
      79.62962963,
    );
    expect(conversionRate("EUR", "USD", rates)).toBe(1.08);
  });

  it("accepts decimal commas and rejects invalid amounts or rates", () => {
    expect(convertedAmount("12,5", "EUR", "USD", rates)).toBe(13.5);
    expect(convertedAmount("12.", "EUR", "USD", rates)).toBeNull();
    expect(convertedAmount("12", "EUR", "CHF", rates)).toBeNull();
  });

  it("builds common conversion rows from the shared common amount list", () => {
    const rows = commonConversionRows("EUR", "USD", rates);

    expect(rows.map((row) => row.sourceAmount)).toEqual([
      ...COMMON_CONVERSION_AMOUNTS,
    ]);
    expect(rows[0]).toEqual({ sourceAmount: 1, targetAmount: 1.08 });
    expect(rows.at(-1)).toEqual({ sourceAmount: 1000, targetAmount: 1080 });
    expect(commonConversionRows("EUR", "CHF", rates)).toEqual([]);
  });
});

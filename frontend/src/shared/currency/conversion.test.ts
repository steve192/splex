import { describe, expect, it } from "vitest";

import {
  conversionRate,
  convertedAmount,
  formatExchangeRate,
} from "./conversion";

const rates = { EUR: "1", USD: "1.08", GBP: "0.86" };

describe("currency conversion", () => {
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

  it("formats rates with six significant digits for the locale", () => {
    expect(formatExchangeRate(0.0869840123, "en")).toBe("0.086984");
    expect(formatExchangeRate(0.0869840123, "de")).toBe("0,086984");
  });
});

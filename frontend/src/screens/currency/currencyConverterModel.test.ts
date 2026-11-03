import { describe, expect, it } from "vitest";

import {
  COMMON_CONVERSION_AMOUNTS,
  commonConversionRows,
  currencyForActivePicker,
  currencyPairAfterSelection,
  currencyPickerTitleKey,
} from "./currencyConverterModel";

const rates = { EUR: "1", USD: "1.08", GBP: "0.86" };

describe("currency converter model", () => {
  it("builds common conversion rows from the shared common amount list", () => {
    const rows = commonConversionRows("EUR", "USD", rates);

    expect(rows.map((row) => row.sourceAmount)).toEqual([
      ...COMMON_CONVERSION_AMOUNTS,
    ]);
    expect(rows[0]).toEqual({ sourceAmount: 1, targetAmount: 1.08 });
    expect(rows.at(-1)).toEqual({ sourceAmount: 1000, targetAmount: 1080 });
    expect(commonConversionRows("EUR", "CHF", rates)).toEqual([]);
  });

  it("resolves active picker labels, values, and selection updates", () => {
    expect(currencyPickerTitleKey("from")).toBe(
      "currencyConverter.fromCurrency",
    );
    expect(currencyPickerTitleKey("to")).toBe("currencyConverter.toCurrency");
    expect(
      currencyForActivePicker({
        activePicker: "from",
        fromCurrency: "EUR",
        toCurrency: "USD",
      }),
    ).toBe("EUR");
    expect(
      currencyPairAfterSelection({
        activePicker: "to",
        selectedCurrency: "GBP",
        fromCurrency: "EUR",
        toCurrency: "USD",
      }),
    ).toEqual({ fromCurrency: "EUR", toCurrency: "GBP" });
  });
});

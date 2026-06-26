import { afterEach, describe, expect, it } from "vitest";

import {
  CURRENCIES,
  currencyCodeOrFallback,
  currencyDisplayName,
  isCurrencyCode,
} from "./currencies";

const originalDisplayNames = Intl.DisplayNames;

describe("currencies", () => {
  afterEach(() => {
    Object.defineProperty(Intl, "DisplayNames", {
      configurable: true,
      value: originalDisplayNames,
    });
  });

  it("exposes a non-empty list of unique ISO codes", () => {
    expect(CURRENCIES).toHaveLength(165);
    expect(new Set(CURRENCIES).size).toBe(CURRENCIES.length);
  });

  it("includes the common defaults and uses 3-letter codes", () => {
    expect(CURRENCIES).toContain("EUR");
    expect(CURRENCIES).toContain("USD");
    expect(CURRENCIES).toContain("XAU");
    for (const code of CURRENCIES) {
      expect(code).toMatch(/^[A-Z]{3}$/);
    }
  });

  it("narrows external currency strings to the supported-currency union", () => {
    expect(isCurrencyCode("JPY")).toBe(true);
    expect(isCurrencyCode("ABC")).toBe(false);
    expect(currencyCodeOrFallback("JPY")).toBe("JPY");
    expect(currencyCodeOrFallback("ABC")).toBe("EUR");
  });

  it("falls back to the code when localized currency names are unavailable", () => {
    Object.defineProperty(Intl, "DisplayNames", {
      configurable: true,
      value: class {
        constructor() {
          throw new Error("not supported");
        }
      },
    });

    expect(currencyDisplayName("EUR", "en")).toBe("EUR");
  });
});

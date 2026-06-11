import { describe, expect, it } from "vitest";

import { CURRENCIES } from "./currencies";

describe("currencies", () => {
  it("exposes a non-empty list of unique ISO codes", () => {
    expect(CURRENCIES.length).toBeGreaterThan(0);
    expect(new Set(CURRENCIES).size).toBe(CURRENCIES.length);
  });

  it("includes the common defaults and uses 3-letter codes", () => {
    expect(CURRENCIES).toContain("EUR");
    expect(CURRENCIES).toContain("USD");
    for (const code of CURRENCIES) {
      expect(code).toMatch(/^[A-Z]{3}$/);
    }
  });
});

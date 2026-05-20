import { beforeEach, describe, expect, it, vi } from "vitest";

import { detectDeviceLocale, interpolate, lookupTranslation } from "./locale";

vi.mock("expo-localization", () => ({
  getLocales: vi.fn()
}));

import * as Localization from "expo-localization";

const getLocalesMock = vi.mocked(Localization.getLocales);

describe("interpolate", () => {
  it("leaves template unchanged when params is undefined", () => {
    expect(interpolate("Hello {name}")).toBe("Hello {name}");
  });

  it("replaces placeholders with values", () => {
    expect(interpolate("Hello {name}, you owe {amount}", { name: "Alice", amount: "10€" })).toBe(
      "Hello Alice, you owe 10€"
    );
  });

  it("converts numeric values to strings", () => {
    expect(interpolate("{count} items", { count: 3 })).toBe("3 items");
  });

  it("keeps unknown placeholders literal", () => {
    expect(interpolate("{a} {b}", { a: "x" })).toBe("x {b}");
  });

  it("ignores placeholders with non-word characters", () => {
    expect(interpolate("{not a key}", { "not a key": "v" })).toBe("{not a key}");
  });
});

describe("lookupTranslation", () => {
  const translations = {
    en: { greeting: "Hello {name}", common: "OK", "only.en": "only english" },
    de: { greeting: "Hallo {name}", common: "OK" }
  };

  it("returns localized template with interpolation", () => {
    expect(lookupTranslation("de", translations, "greeting", { name: "Bob" })).toBe("Hallo Bob");
  });

  it("falls back to english when key missing in target locale", () => {
    expect(lookupTranslation("de", translations, "only.en")).toBe("only english");
  });

  it("returns the key itself when missing in both locales", () => {
    expect(lookupTranslation("de", translations, "nonexistent")).toBe("nonexistent");
  });
});

describe("detectDeviceLocale", () => {
  beforeEach(() => {
    getLocalesMock.mockReset();
  });

  it("returns 'de' when device language tag starts with de", () => {
    getLocalesMock.mockReturnValue([
      { languageTag: "de-DE", languageCode: "de" } as Localization.Locale
    ]);
    expect(detectDeviceLocale()).toBe("de");
  });

  it("returns 'en' for en-US", () => {
    getLocalesMock.mockReturnValue([
      { languageTag: "en-US", languageCode: "en" } as Localization.Locale
    ]);
    expect(detectDeviceLocale()).toBe("en");
  });

  it("falls back to 'en' for unsupported locales", () => {
    getLocalesMock.mockReturnValue([
      { languageTag: "fr-FR", languageCode: "fr" } as Localization.Locale
    ]);
    expect(detectDeviceLocale()).toBe("en");
  });

  it("picks first supported tag when device returns a list", () => {
    getLocalesMock.mockReturnValue([
      { languageTag: "fr-FR", languageCode: "fr" } as Localization.Locale,
      { languageTag: "de-AT", languageCode: "de" } as Localization.Locale
    ]);
    expect(detectDeviceLocale()).toBe("de");
  });

  it("falls back to 'en' when device returns empty list", () => {
    getLocalesMock.mockReturnValue([] as unknown as ReturnType<typeof Localization.getLocales>);
    expect(detectDeviceLocale()).toBe("en");
  });

  it("handles entries with missing tags", () => {
    getLocalesMock.mockReturnValue([
      { languageTag: "", languageCode: "" } as Localization.Locale,
      { languageTag: "de", languageCode: "de" } as Localization.Locale
    ]);
    expect(detectDeviceLocale()).toBe("de");
  });
});

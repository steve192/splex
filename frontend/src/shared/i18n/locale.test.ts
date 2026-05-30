import { readdirSync, readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { detectDeviceLocale, interpolate, lookupTranslation, normalizeLocaleTag } from "./locale";

vi.mock("expo-localization", () => ({
  getLocales: vi.fn()
}));

import * as Localization from "expo-localization";

const getLocalesMock = vi.mocked(Localization.getLocales);
const LOCALES_DIR = new URL("./locales/", import.meta.url);

const readTranslations = (fileName: string): Record<string, string> => {
  return JSON.parse(readFileSync(new URL(fileName, LOCALES_DIR), "utf8")) as Record<string, string>;
};

const getPlaceholders = (value: string): string[] => {
  return Array.from(value.matchAll(/\{(\w+)\}/g), ([, name]) => name);
};

const sortStrings = (values: string[]): string[] => {
  return [...values].sort((left, right) => left.localeCompare(right));
};

describe("locale files", () => {
  const english = readTranslations("en.json");
  const englishKeys = Object.keys(english);
  const localeFiles = readdirSync(LOCALES_DIR)
    .filter((fileName) => fileName.endsWith(".json") && fileName !== "en.json")
    .sort((left, right) => left.localeCompare(right));

  it.each(localeFiles)("%s preserves english keys and placeholders", (fileName) => {
    const translations = readTranslations(fileName);
    const translationKeys = Object.keys(translations);

    if ("de.json" === fileName) {
      expect(sortStrings(translationKeys)).toEqual(sortStrings(englishKeys));
    } else {
      expect(translationKeys).toEqual(englishKeys);
    }

    englishKeys.forEach((key) => {
      expect(sortStrings(getPlaceholders(translations[key] ?? ""))).toEqual(
        sortStrings(getPlaceholders(english[key] ?? ""))
      );
    });
  });

});

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

  it("returns 'fr' for fr-FR", () => {
    getLocalesMock.mockReturnValue([
      { languageTag: "fr-FR", languageCode: "fr" } as Localization.Locale
    ]);
    expect(detectDeviceLocale()).toBe("fr");
  });

  it("falls back to 'en' for unsupported locales", () => {
    getLocalesMock.mockReturnValue([
      { languageTag: "ja-JP", languageCode: "ja" } as Localization.Locale
    ]);
    expect(detectDeviceLocale()).toBe("en");
  });

  it("picks the first supported tag when device returns a list", () => {
    getLocalesMock.mockReturnValue([
      { languageTag: "fr-FR", languageCode: "fr" } as Localization.Locale,
      { languageTag: "de-AT", languageCode: "de" } as Localization.Locale
    ]);
    expect(detectDeviceLocale()).toBe("fr");
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

  it("maps norwegian bokmal to 'no'", () => {
    getLocalesMock.mockReturnValue([
      { languageTag: "nb-NO", languageCode: "nb" } as Localization.Locale
    ]);
    expect(detectDeviceLocale()).toBe("no");
  });
});

describe("normalizeLocaleTag", () => {
  it("returns null for unknown tags", () => {
    expect(normalizeLocaleTag("ja-JP")).toBeNull();
  });

  it("normalizes aliases", () => {
    expect(normalizeLocaleTag("nn-NO")).toBe("no");
  });
});

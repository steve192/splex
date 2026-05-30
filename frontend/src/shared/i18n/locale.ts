/**
 * Pure i18n helpers extracted from I18nContext so they can be unit-tested
 * without mounting a React provider.
 */
import * as Localization from "expo-localization";

export const SUPPORTED_LOCALES = [
  "az",
  "be",
  "bg",
  "bs",
  "ca",
  "cs",
  "da",
  "de",
  "el",
  "en",
  "es",
  "et",
  "fi",
  "fr",
  "ga",
  "hr",
  "hu",
  "hy",
  "is",
  "it",
  "ka",
  "kk",
  "la",
  "lb",
  "lt",
  "lv",
  "mk",
  "mt",
  "nl",
  "no",
  "pl",
  "pt",
  "rm",
  "ro",
  "ru",
  "sk",
  "sl",
  "sq",
  "sr",
  "sv",
  "tr",
  "uk"
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  az: "Azərbaycanca",
  be: "Беларуская",
  bg: "Български",
  bs: "Bosanski",
  ca: "Català",
  cs: "Čeština",
  da: "Dansk",
  de: "Deutsch",
  el: "Ελληνικά",
  en: "English",
  es: "Español",
  et: "Eesti",
  fi: "Suomi",
  fr: "Français",
  ga: "Gaeilge",
  hr: "Hrvatski",
  hu: "Magyar",
  hy: "Հայերեն",
  is: "Íslenska",
  it: "Italiano",
  ka: "ქართული",
  kk: "Қазақша",
  la: "Latina",
  lb: "Lëtzebuergesch",
  lt: "Lietuvių",
  lv: "Latviešu",
  mk: "Македонски",
  mt: "Malti",
  nl: "Nederlands",
  no: "Norsk",
  pl: "Polski",
  pt: "Português",
  rm: "Rumantsch",
  ro: "Română",
  ru: "Русский",
  sk: "Slovenčina",
  sl: "Slovenščina",
  sq: "Shqip",
  sr: "Српски",
  sv: "Svenska",
  tr: "Türkçe",
  uk: "Українська"
};

const SUPPORTED_LOCALE_SET = new Set<string>(SUPPORTED_LOCALES);
const LOCALE_ALIASES: Record<string, Locale> = {
  nb: "no",
  nn: "no"
};
const DATE_PICKER_LOCALES: Partial<Record<Locale, string>> = {
  ca: "ca",
  cs: "cs",
  da: "da",
  de: "de",
  el: "el",
  en: "en",
  es: "es",
  fi: "fi",
  fr: "fr",
  it: "it",
  nl: "nl",
  no: "noNO",
  pl: "pl",
  pt: "pt",
  ro: "ro",
  ru: "ru",
  sv: "sv",
  tr: "tr",
  uk: "ukUA"
};

export const LOCALE_STORAGE_KEY = "splex.locale";

type Params = Record<string, string | number>;

export function isSupportedLocale(value: string): value is Locale {
  return SUPPORTED_LOCALE_SET.has(value);
}

export function normalizeLocaleTag(tag: string): Locale | null {
  const base = tag.toLowerCase().split(/[-_]/)[0];
  if (isSupportedLocale(base)) {
    return base;
  }
  return LOCALE_ALIASES[base] ?? null;
}

export function getLocaleLabel(locale: Locale): string {
  return LOCALE_LABELS[locale];
}

export function getDatePickerLocale(locale: Locale): string {
  return DATE_PICKER_LOCALES[locale] ?? "en";
}

/** Replace `{name}` placeholders with values from `params`. Missing keys are left literal. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Pick the first supported locale from the device's locale list, falling back to "en".
 * Region tags like "de-DE" reduce to "de".
 */
export function detectDeviceLocale(): Locale {
  const tags = Localization.getLocales().map((entry) => entry.languageTag || entry.languageCode || "");
  for (const tag of tags) {
    const locale = normalizeLocaleTag(tag);
    if (locale) return locale;
  }
  return "en";
}

/** Look up a key in `locale` with English fallback, then return the key itself. */
export function lookupTranslation(
  locale: Locale,
  translations: Partial<Record<Locale, Record<string, string>>> & { en: Record<string, string> },
  key: string,
  params?: Params
): string {
  const template = translations[locale]?.[key] ?? translations.en[key] ?? key;
  return interpolate(template, params);
}

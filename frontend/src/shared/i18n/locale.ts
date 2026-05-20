/**
 * Pure i18n helpers extracted from I18nContext so they can be unit-tested
 * without mounting a React provider.
 */
import * as Localization from "expo-localization";

export type Locale = "en" | "de";
export const SUPPORTED_LOCALES: Locale[] = ["en", "de"];
export const LOCALE_STORAGE_KEY = "splex.locale";

type Params = Record<string, string | number>;

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
    const base = tag.toLowerCase().split("-")[0];
    if ((SUPPORTED_LOCALES as string[]).includes(base)) return base as Locale;
  }
  return "en";
}

/** Look up a key in `locale` with English fallback, then return the key itself. */
export function lookupTranslation(
  locale: Locale,
  translations: Record<Locale, Record<string, string>>,
  key: string,
  params?: Params
): string {
  const template = translations[locale][key] ?? translations.en[key] ?? key;
  return interpolate(template, params);
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

import de from "./locales/de.json";
import en from "./locales/en.json";

type Locale = "en" | "de";
type TranslationMap = Record<string, string>;
type Params = Record<string, string | number>;

const translations: Record<Locale, TranslationMap> = { en, de };

export type TranslateFn = (key: string, params?: Params) => string;

type I18nContextValue = {
  locale: Locale;
  setLocale(locale: Locale): void;
  t: TranslateFn;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    AsyncStorage.getItem("splex.locale").then((stored) => {
      if (stored === "en" || stored === "de") {
        setLocaleState(stored);
      }
    });
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale(nextLocale: Locale) {
        setLocaleState(nextLocale);
        AsyncStorage.setItem("splex.locale", nextLocale).catch(() => undefined);
      },
      t(key: string, params?: Params) {
        const template = translations[locale][key] ?? translations.en[key] ?? key;
        return interpolate(template, params);
      }
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }
  return value;
}

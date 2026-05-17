import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

import de from "./locales/de.json";
import en from "./locales/en.json";

type Locale = "en" | "de";
type TranslationMap = Record<string, string>;

const translations: Record<Locale, TranslationMap> = { en, de };

type I18nContextValue = {
  locale: Locale;
  setLocale(locale: Locale): void;
  t(key: string): string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

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
      t(key: string) {
        return translations[locale][key] ?? translations.en[key] ?? key;
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


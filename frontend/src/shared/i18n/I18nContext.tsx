import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import az from "./locales/az.json";
import be from "./locales/be.json";
import bg from "./locales/bg.json";
import bs from "./locales/bs.json";
import ca from "./locales/ca.json";
import cs from "./locales/cs.json";
import da from "./locales/da.json";
import de from "./locales/de.json";
import el from "./locales/el.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import et from "./locales/et.json";
import fi from "./locales/fi.json";
import fr from "./locales/fr.json";
import ga from "./locales/ga.json";
import hr from "./locales/hr.json";
import hu from "./locales/hu.json";
import hy from "./locales/hy.json";
import is from "./locales/is.json";
import it from "./locales/it.json";
import ka from "./locales/ka.json";
import kk from "./locales/kk.json";
import la from "./locales/la.json";
import lb from "./locales/lb.json";
import lt from "./locales/lt.json";
import lv from "./locales/lv.json";
import mk from "./locales/mk.json";
import mt from "./locales/mt.json";
import nl from "./locales/nl.json";
import no from "./locales/no.json";
import pl from "./locales/pl.json";
import pt from "./locales/pt.json";
import rm from "./locales/rm.json";
import ro from "./locales/ro.json";
import ru from "./locales/ru.json";
import sk from "./locales/sk.json";
import sl from "./locales/sl.json";
import sq from "./locales/sq.json";
import sr from "./locales/sr.json";
import sv from "./locales/sv.json";
import tr from "./locales/tr.json";
import uk from "./locales/uk.json";
import { LOCALE_STORAGE_KEY, Locale, detectDeviceLocale, isSupportedLocale, lookupTranslation } from "./locale";

type TranslationMap = Record<string, string>;
type Params = Record<string, string | number>;

const translations: Partial<Record<Locale, TranslationMap>> & { en: TranslationMap } = {
  az,
  be,
  bg,
  bs,
  ca,
  cs,
  da,
  de,
  el,
  en,
  es,
  et,
  fi,
  fr,
  ga,
  hr,
  hu,
  hy,
  is,
  it,
  ka,
  kk,
  la,
  lb,
  lt,
  lv,
  mk,
  mt,
  nl,
  no,
  pl,
  pt,
  rm,
  ro,
  ru,
  sk,
  sl,
  sq,
  sr,
  sv,
  tr,
  uk
};

export type TranslateFn = (key: string, params?: Params) => string;

type I18nContextValue = {
  locale: Locale;
  setLocale(locale: Locale): void;
  t: TranslateFn;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    AsyncStorage.getItem(LOCALE_STORAGE_KEY).then((stored) => {
      if (stored && isSupportedLocale(stored)) {
        setLocale(stored);
        return;
      }
      const detected = detectDeviceLocale();
      setLocale(detected);
      AsyncStorage.setItem(LOCALE_STORAGE_KEY, detected).catch(() => undefined);
    });
  }, []);

  const updateLocale = useCallback((nextLocale: Locale) => {
    setLocale(nextLocale);
    AsyncStorage.setItem(LOCALE_STORAGE_KEY, nextLocale).catch(() => undefined);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: updateLocale,
      t(key: string, params?: Params) {
        return lookupTranslation(locale, translations, key, params);
      }
    }),
    [locale, updateLocale]
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

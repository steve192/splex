import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";

import { OverviewStackParamList } from "../../application/navigationTypes";
import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import {
  currencyRatesAreStale,
  loadCurrencyRates,
  type CurrencyRatesSnapshot,
} from "../../shared/currency/rates";
import {
  currencyCodeOrFallback,
  currencySelectionOptions,
  type CurrencyCode,
} from "../../shared/lib/currencies";
import { Screen } from "../../shared/ui/Screen";
import type { SelectionOption } from "../../shared/ui/SelectionSheet";
import {
  commonConversionRows,
  conversionRate,
  convertedAmount,
  currencyPairAfterSelection,
  type ActiveCurrencyPicker,
} from "./currencyConverterModel";
import {
  loadCurrencyConverterCurrencyPair,
  saveCurrencyConverterCurrencyPair,
} from "./currencyConverterPreferences";
import { CurrencyConverterContent } from "./CurrencyConverterContent";

type Props = NativeStackScreenProps<
  OverviewStackParamList,
  "CurrencyConverter"
>;

export function CurrencyConverterScreen({}: Readonly<Props>) {
  const { api, user } = useAuth();
  const { locale } = useI18n();
  const { width } = useWindowDimensions();
  const defaultCurrency = currencyCodeOrFallback(user?.default_currency);
  const [amount, setAmount] = useState("1");
  const [fromCurrency, setFromCurrency] =
    useState<CurrencyCode>(defaultCurrency);
  const [toCurrency, setToCurrency] = useState<CurrencyCode>(
    defaultCurrency === "EUR" ? "USD" : "EUR",
  );
  const [snapshot, setSnapshot] = useState<CurrencyRatesSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [activeCurrencyPicker, setActiveCurrencyPicker] =
    useState<ActiveCurrencyPicker>(null);
  const currencyPairChangedRef = useRef(false);

  const loadRates = useCallback(
    async (force = false) => {
      setLoading(true);
      setRefreshFailed(false);
      try {
        const result = await loadCurrencyRates(api, {
          force,
          onCached: setSnapshot,
        });
        setSnapshot(result.snapshot);
        setRefreshFailed(result.refreshFailed);
      } catch {
        setRefreshFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  useFocusEffect(
    useCallback(() => {
      void loadRates();
    }, [loadRates]),
  );

  useEffect(() => {
    let active = true;
    loadCurrencyConverterCurrencyPair()
      .then((pair) => {
        if (!active || !pair || currencyPairChangedRef.current) return;
        setFromCurrency(pair.fromCurrency);
        setToCurrency(pair.toCurrency);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const currencyOptions = useMemo<SelectionOption<CurrencyCode>[]>(
    () =>
      currencySelectionOptions(locale).filter(
        (currency) => snapshot?.rates[currency.value],
      ),
    [locale, snapshot],
  );
  const converted = snapshot
    ? convertedAmount(amount, fromCurrency, toCurrency, snapshot.rates)
    : null;
  const rate = snapshot
    ? conversionRate(fromCurrency, toCurrency, snapshot.rates)
    : null;
  const commonRows = snapshot
    ? commonConversionRows(fromCurrency, toCurrency, snapshot.rates)
    : [];
  const showStaleWarning = Boolean(
    snapshot && refreshFailed && currencyRatesAreStale(snapshot),
  );

  function selectCurrency(currency: CurrencyCode) {
    if (!activeCurrencyPicker) return;
    const nextPair = currencyPairAfterSelection({
      activePicker: activeCurrencyPicker,
      selectedCurrency: currency,
      fromCurrency,
      toCurrency,
    });
    setFromCurrency(nextPair.fromCurrency);
    setToCurrency(nextPair.toCurrency);
    currencyPairChangedRef.current = true;
    void saveCurrencyConverterCurrencyPair(nextPair).catch(() => undefined);
  }

  function swapCurrencies() {
    const nextFromCurrency = toCurrency;
    const nextToCurrency = fromCurrency;
    setFromCurrency(nextFromCurrency);
    setToCurrency(nextToCurrency);
    currencyPairChangedRef.current = true;
    void saveCurrencyConverterCurrencyPair({
      fromCurrency: nextFromCurrency,
      toCurrency: nextToCurrency,
    }).catch(() => undefined);
  }

  return (
    <Screen>
      <CurrencyConverterContent
        snapshot={snapshot}
        loading={loading}
        showStaleWarning={showStaleWarning}
        amount={amount}
        fromCurrency={fromCurrency}
        toCurrency={toCurrency}
        convertedAmount={converted}
        rate={rate}
        commonRows={commonRows}
        activeCurrencyPicker={activeCurrencyPicker}
        currencyOptions={currencyOptions}
        width={width}
        onAmountChange={setAmount}
        onOpenCurrencyPicker={setActiveCurrencyPicker}
        onSwapCurrencies={swapCurrencies}
        onRefreshRates={() => void loadRates(true)}
        onSelectCurrency={selectCurrency}
      />
    </Screen>
  );
}

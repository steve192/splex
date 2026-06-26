import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";

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
import {
  SelectionOption,
  SelectionSheet,
} from "../../shared/ui/SelectionSheet";
import { MoneyAmountInput } from "../../shared/ui/MoneyAmountInput";
import { styles } from "../../shared/ui/styles";
import {
  commonConversionRows,
  conversionRate,
  convertedAmount,
  type CommonConversionRow,
} from "./currencyConverterModel";
import {
  loadCurrencyConverterCurrencyPair,
  saveCurrencyConverterCurrencyPair,
} from "./currencyConverterPreferences";
import { shouldStackCurrencyRatesInfo } from "./currencyConverterLayout";

type Props = NativeStackScreenProps<
  OverviewStackParamList,
  "CurrencyConverter"
>;
type ActiveCurrencyPicker = "from" | "to" | null;

function formatMoney(
  amount: number,
  currency: CurrencyCode,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatRate(rate: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumSignificantDigits: 6 }).format(
    rate,
  );
}

function formatFetchedAt(fetchedAt: string, locale: string): string {
  const date = new Date(fetchedAt);
  if (Number.isNaN(date.getTime())) return fetchedAt;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

type CommonValuesCardProps = Readonly<{
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rows: CommonConversionRow[];
}>;

function CommonValuesCard({
  fromCurrency,
  toCurrency,
  rows,
}: CommonValuesCardProps) {
  const { locale, t } = useI18n();
  const theme = useTheme();
  if (rows.length === 0) return null;

  return (
    <Card style={styles.card} mode="outlined">
      <Card.Content style={styles.currencyConverterCommonValues}>
        <Text variant="titleSmall">{t("currencyConverter.commonValues")}</Text>
        <View style={styles.currencyConverterCommonValueTable}>
          <View
            style={[
              styles.currencyConverterCommonValueRow,
              styles.currencyConverterCommonValueHeader,
              { borderBottomColor: theme.colors.outlineVariant },
            ]}
          >
            <Text variant="labelMedium">{fromCurrency}</Text>
            <Text
              variant="labelMedium"
              style={styles.currencyConverterCommonValueTarget}
            >
              {toCurrency}
            </Text>
          </View>
          {rows.map((row) => (
            <View
              key={row.sourceAmount}
              style={[
                styles.currencyConverterCommonValueRow,
                { borderBottomColor: theme.colors.outlineVariant },
              ]}
            >
              <Text variant="bodyMedium">
                {formatMoney(row.sourceAmount, fromCurrency, locale)}
              </Text>
              <Text
                variant="bodyMedium"
                style={styles.currencyConverterCommonValueTarget}
              >
                {formatMoney(row.targetAmount, toCurrency, locale)}
              </Text>
            </View>
          ))}
        </View>
      </Card.Content>
    </Card>
  );
}

export function CurrencyConverterScreen({}: Readonly<Props>) {
  const { api, user } = useAuth();
  const { locale, t } = useI18n();
  const theme = useTheme();
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
      const result = await loadCurrencyRates(api, {
        force,
        onCached: setSnapshot,
      });
      setSnapshot(result.snapshot);
      setRefreshFailed(result.refreshFailed);
      setLoading(false);
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
    if (activeCurrencyPicker === "from") {
      setFromCurrency(currency);
      currencyPairChangedRef.current = true;
      void saveCurrencyConverterCurrencyPair({
        fromCurrency: currency,
        toCurrency,
      }).catch(() => undefined);
    } else if (activeCurrencyPicker === "to") {
      setToCurrency(currency);
      currencyPairChangedRef.current = true;
      void saveCurrencyConverterCurrencyPair({
        fromCurrency,
        toCurrency: currency,
      }).catch(() => undefined);
    }
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
      {snapshot ? (
        <>
          {showStaleWarning ? (
            <Card style={styles.currencyConverterWarning} mode="contained">
              <Card.Content style={styles.currencyConverterWarningContent}>
                <Text variant="titleSmall">
                  {t("currencyConverter.ratesOutdated")}
                </Text>
                <Text variant="bodyMedium">
                  {t("currencyConverter.ratesOutdatedHelp")}
                </Text>
              </Card.Content>
            </Card>
          ) : null}
          <Card style={styles.card} mode="elevated">
            <Card.Content style={styles.currencyConverterContent}>
              <MoneyAmountInput
                mode="outlined"
                label={t("currencyConverter.amount")}
                value={amount}
                onChangeText={setAmount}
              />
              <View style={styles.currencyConverterCurrencies}>
                <Button
                  mode="outlined"
                  icon="currency-usd"
                  style={styles.currencyConverterCurrencyButton}
                  onPress={() => setActiveCurrencyPicker("from")}
                >
                  {fromCurrency}
                </Button>
                <IconButton
                  icon="swap-horizontal"
                  accessibilityLabel={t("currencyConverter.swap")}
                  onPress={swapCurrencies}
                />
                <Button
                  mode="outlined"
                  icon="currency-usd"
                  style={styles.currencyConverterCurrencyButton}
                  onPress={() => setActiveCurrencyPicker("to")}
                >
                  {toCurrency}
                </Button>
              </View>
            </Card.Content>
          </Card>
          <Card style={styles.card} mode="contained">
            <Card.Content style={styles.currencyConverterResult}>
              <Text variant="labelLarge">
                {t("currencyConverter.convertedAmount")}
              </Text>
              <Text variant="headlineMedium">
                {converted === null
                  ? t("currencyConverter.invalidAmount")
                  : formatMoney(converted, toCurrency, locale)}
              </Text>
              {rate !== null ? (
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSecondaryContainer }}
                >
                  {t("currencyConverter.rate", {
                    from: fromCurrency,
                    to: toCurrency,
                    rate: formatRate(rate, locale),
                  })}
                </Text>
              ) : null}
            </Card.Content>
          </Card>
          <CommonValuesCard
            fromCurrency={fromCurrency}
            toCurrency={toCurrency}
            rows={commonRows}
          />
          <Card style={styles.card} mode="outlined">
            <Card.Content
              style={[
                styles.currencyConverterRatesInfo,
                shouldStackCurrencyRatesInfo(width) &&
                  styles.currencyConverterRatesInfoCompact,
              ]}
            >
              <View style={styles.currencyConverterRatesCopy}>
                <Text variant="titleSmall">{t("currencyConverter.rates")}</Text>
                <Text variant="bodyMedium">
                  {t("currencyConverter.ratesUpdated", {
                    date: formatFetchedAt(snapshot.fetched_at, locale),
                  })}
                </Text>
              </View>
              <Button
                icon="refresh"
                loading={loading}
                disabled={loading}
                style={styles.currencyConverterRefreshButton}
                onPress={() => void loadRates(true)}
              >
                {t("currencyConverter.refreshRates")}
              </Button>
            </Card.Content>
          </Card>
          <SelectionSheet
            visible={activeCurrencyPicker !== null}
            title={t(
              activeCurrencyPicker === "from"
                ? "currencyConverter.fromCurrency"
                : "currencyConverter.toCurrency",
            )}
            options={currencyOptions}
            value={activeCurrencyPicker === "from" ? fromCurrency : toCurrency}
            searchable
            onSelect={selectCurrency}
            onDismiss={() => setActiveCurrencyPicker(null)}
          />
        </>
      ) : loading ? (
        <View style={styles.currencyConverterLoading}>
          <ActivityIndicator />
        </View>
      ) : (
        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.currencyConverterEmpty}>
            <Text variant="bodyLarge">{t("currencyConverter.noRates")}</Text>
            <Button icon="refresh" onPress={() => void loadRates(true)}>
              {t("common.retry")}
            </Button>
          </Card.Content>
        </Card>
      )}
    </Screen>
  );
}

import { View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";

import { useI18n } from "../../shared/i18n/I18nContext";
import type { CurrencyRatesSnapshot } from "../../shared/currency/rates";
import type { CurrencyCode } from "../../shared/lib/currencies";
import { MoneyAmountInput } from "../../shared/ui/MoneyAmountInput";
import type { SelectionOption } from "../../shared/ui/SelectionSheet";
import { SelectionSheet } from "../../shared/ui/SelectionSheet";
import { styles } from "../../shared/ui/styles";
import { shouldStackCurrencyRatesInfo } from "./currencyConverterLayout";
import {
  currencyForActivePicker,
  currencyPickerTitleKey,
  type ActiveCurrencyPicker,
  type CommonConversionRow,
} from "./currencyConverterModel";

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

export function CurrencyConverterContent({
  snapshot,
  loading,
  showStaleWarning,
  amount,
  fromCurrency,
  toCurrency,
  convertedAmount,
  rate,
  commonRows,
  activeCurrencyPicker,
  currencyOptions,
  width,
  onAmountChange,
  onOpenCurrencyPicker,
  onSwapCurrencies,
  onRefreshRates,
  onSelectCurrency,
}: Readonly<{
  snapshot: CurrencyRatesSnapshot | null;
  loading: boolean;
  showStaleWarning: boolean;
  amount: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  convertedAmount: number | null;
  rate: number | null;
  commonRows: CommonConversionRow[];
  activeCurrencyPicker: ActiveCurrencyPicker;
  currencyOptions: SelectionOption<CurrencyCode>[];
  width: number;
  onAmountChange: (amount: string) => void;
  onOpenCurrencyPicker: (picker: ActiveCurrencyPicker) => void;
  onSwapCurrencies: () => void;
  onRefreshRates: () => void;
  onSelectCurrency: (currency: CurrencyCode) => void;
}>) {
  const { t } = useI18n();

  if (snapshot) {
    return (
      <CurrencyConverterLoadedContent
        snapshot={snapshot}
        loading={loading}
        showStaleWarning={showStaleWarning}
        amount={amount}
        fromCurrency={fromCurrency}
        toCurrency={toCurrency}
        convertedAmount={convertedAmount}
        rate={rate}
        commonRows={commonRows}
        activeCurrencyPicker={activeCurrencyPicker}
        currencyOptions={currencyOptions}
        width={width}
        onAmountChange={onAmountChange}
        onOpenCurrencyPicker={onOpenCurrencyPicker}
        onSwapCurrencies={onSwapCurrencies}
        onRefreshRates={onRefreshRates}
        onSelectCurrency={onSelectCurrency}
      />
    );
  }
  if (loading) {
    return (
      <View style={styles.currencyConverterLoading}>
        <ActivityIndicator />
      </View>
    );
  }
  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content style={styles.currencyConverterEmpty}>
        <Text variant="bodyLarge">{t("currencyConverter.noRates")}</Text>
        <Button icon="refresh" onPress={onRefreshRates}>
          {t("common.retry")}
        </Button>
      </Card.Content>
    </Card>
  );
}

function CurrencyConverterLoadedContent({
  snapshot,
  loading,
  showStaleWarning,
  amount,
  fromCurrency,
  toCurrency,
  convertedAmount,
  rate,
  commonRows,
  activeCurrencyPicker,
  currencyOptions,
  width,
  onAmountChange,
  onOpenCurrencyPicker,
  onSwapCurrencies,
  onRefreshRates,
  onSelectCurrency,
}: Readonly<{
  snapshot: CurrencyRatesSnapshot;
  loading: boolean;
  showStaleWarning: boolean;
  amount: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  convertedAmount: number | null;
  rate: number | null;
  commonRows: CommonConversionRow[];
  activeCurrencyPicker: ActiveCurrencyPicker;
  currencyOptions: SelectionOption<CurrencyCode>[];
  width: number;
  onAmountChange: (amount: string) => void;
  onOpenCurrencyPicker: (picker: ActiveCurrencyPicker) => void;
  onSwapCurrencies: () => void;
  onRefreshRates: () => void;
  onSelectCurrency: (currency: CurrencyCode) => void;
}>) {
  const { locale, t } = useI18n();
  const convertedAmountLabel =
    convertedAmount === null
      ? t("currencyConverter.invalidAmount")
      : formatMoney(convertedAmount, toCurrency, locale);

  return (
    <>
      <RatesOutdatedWarning visible={showStaleWarning} />
      <CurrencyInputCard
        amount={amount}
        fromCurrency={fromCurrency}
        toCurrency={toCurrency}
        onAmountChange={onAmountChange}
        onOpenCurrencyPicker={onOpenCurrencyPicker}
        onSwapCurrencies={onSwapCurrencies}
      />
      <CurrencyResultCard
        fromCurrency={fromCurrency}
        toCurrency={toCurrency}
        convertedAmountLabel={convertedAmountLabel}
        rate={rate}
      />
      <CommonValuesCard
        fromCurrency={fromCurrency}
        toCurrency={toCurrency}
        rows={commonRows}
      />
      <RatesInfoCard
        fetchedAt={snapshot.fetched_at}
        loading={loading}
        width={width}
        onRefreshRates={onRefreshRates}
      />
      <SelectionSheet
        visible={Boolean(activeCurrencyPicker)}
        title={t(currencyPickerTitleKey(activeCurrencyPicker))}
        options={currencyOptions}
        value={currencyForActivePicker({
          activePicker: activeCurrencyPicker,
          fromCurrency,
          toCurrency,
        })}
        searchable
        onSelect={onSelectCurrency}
        onDismiss={() => onOpenCurrencyPicker(null)}
      />
    </>
  );
}

function RatesOutdatedWarning({ visible }: Readonly<{ visible: boolean }>) {
  const { t } = useI18n();
  if (!visible) return null;

  return (
    <Card style={styles.currencyConverterWarning} mode="contained">
      <Card.Content style={styles.currencyConverterWarningContent}>
        <Text variant="titleSmall">{t("currencyConverter.ratesOutdated")}</Text>
        <Text variant="bodyMedium">
          {t("currencyConverter.ratesOutdatedHelp")}
        </Text>
      </Card.Content>
    </Card>
  );
}

function CurrencyInputCard({
  amount,
  fromCurrency,
  toCurrency,
  onAmountChange,
  onOpenCurrencyPicker,
  onSwapCurrencies,
}: Readonly<{
  amount: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  onAmountChange: (amount: string) => void;
  onOpenCurrencyPicker: (picker: ActiveCurrencyPicker) => void;
  onSwapCurrencies: () => void;
}>) {
  const { t } = useI18n();

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content style={styles.currencyConverterContent}>
        <MoneyAmountInput
          mode="outlined"
          label={t("currencyConverter.amount")}
          value={amount}
          onChangeText={onAmountChange}
        />
        <View style={styles.currencyConverterCurrencies}>
          <Button
            mode="outlined"
            icon="currency-usd"
            style={styles.currencyConverterCurrencyButton}
            onPress={() => onOpenCurrencyPicker("from")}
          >
            {fromCurrency}
          </Button>
          <IconButton
            icon="swap-horizontal"
            accessibilityLabel={t("currencyConverter.swap")}
            onPress={onSwapCurrencies}
          />
          <Button
            mode="outlined"
            icon="currency-usd"
            style={styles.currencyConverterCurrencyButton}
            onPress={() => onOpenCurrencyPicker("to")}
          >
            {toCurrency}
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
}

function CurrencyResultCard({
  fromCurrency,
  toCurrency,
  convertedAmountLabel,
  rate,
}: Readonly<{
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  convertedAmountLabel: string;
  rate: number | null;
}>) {
  const { locale, t } = useI18n();
  const theme = useTheme();

  return (
    <Card style={styles.card} mode="contained">
      <Card.Content style={styles.currencyConverterResult}>
        <Text variant="labelLarge">
          {t("currencyConverter.convertedAmount")}
        </Text>
        <Text variant="headlineMedium">{convertedAmountLabel}</Text>
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
  );
}

function CommonValuesCard({
  fromCurrency,
  toCurrency,
  rows,
}: Readonly<{
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rows: CommonConversionRow[];
}>) {
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

function RatesInfoCard({
  fetchedAt,
  loading,
  width,
  onRefreshRates,
}: Readonly<{
  fetchedAt: string;
  loading: boolean;
  width: number;
  onRefreshRates: () => void;
}>) {
  const { locale, t } = useI18n();

  return (
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
              date: formatFetchedAt(fetchedAt, locale),
            })}
          </Text>
        </View>
        <Button
          icon="refresh"
          loading={loading}
          disabled={loading}
          style={styles.currencyConverterRefreshButton}
          onPress={onRefreshRates}
        >
          {t("currencyConverter.refreshRates")}
        </Button>
      </Card.Content>
    </Card>
  );
}

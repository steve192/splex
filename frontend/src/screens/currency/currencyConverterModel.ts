import { conversionRate } from "../../shared/currency/conversion";
import type { CurrencyCode } from "../../shared/lib/currencies";

export type ActiveCurrencyPicker = "from" | "to" | null;

export const COMMON_CONVERSION_AMOUNTS = [
  1, 3, 5, 10, 25, 50, 100, 1000,
] as const;

export type CommonConversionRow = {
  sourceAmount: number;
  targetAmount: number;
};

export function commonConversionRows(
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  rates: Record<string, string>,
): CommonConversionRow[] {
  const rate = conversionRate(fromCurrency, toCurrency, rates);
  if (rate === null) return [];
  return COMMON_CONVERSION_AMOUNTS.map((sourceAmount) => ({
    sourceAmount,
    targetAmount: sourceAmount * rate,
  }));
}

export function currencyPickerTitleKey(
  activePicker: ActiveCurrencyPicker,
): string {
  return activePicker === "from"
    ? "currencyConverter.fromCurrency"
    : "currencyConverter.toCurrency";
}

export function currencyForActivePicker({
  activePicker,
  fromCurrency,
  toCurrency,
}: Readonly<{
  activePicker: ActiveCurrencyPicker;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
}>): CurrencyCode {
  return activePicker === "from" ? fromCurrency : toCurrency;
}

export function currencyPairAfterSelection({
  activePicker,
  selectedCurrency,
  fromCurrency,
  toCurrency,
}: Readonly<{
  activePicker: ActiveCurrencyPicker;
  selectedCurrency: CurrencyCode;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
}>): { fromCurrency: CurrencyCode; toCurrency: CurrencyCode } {
  if (activePicker === "from") {
    return { fromCurrency: selectedCurrency, toCurrency };
  }
  if (activePicker === "to") {
    return { fromCurrency, toCurrency: selectedCurrency };
  }
  return { fromCurrency, toCurrency };
}

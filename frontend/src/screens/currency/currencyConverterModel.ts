import type { CurrencyCode } from "../../shared/lib/currencies";

function numericRate(
  currency: CurrencyCode,
  rates: Record<string, string>,
): number | null {
  const rate = Number(rates[currency]);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export const COMMON_CONVERSION_AMOUNTS = [
  1, 3, 5, 10, 25, 50, 100, 1000,
] as const;

export type CommonConversionRow = {
  sourceAmount: number;
  targetAmount: number;
};

export function convertedAmount(
  amountText: string,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  rates: Record<string, string>,
): number | null {
  const normalizedAmount = amountText.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalizedAmount)) return null;
  const amount = Number(normalizedAmount);
  const fromRate = numericRate(fromCurrency, rates);
  const toRate = numericRate(toCurrency, rates);
  if (!Number.isFinite(amount) || fromRate === null || toRate === null)
    return null;
  return (amount * toRate) / fromRate;
}

export function conversionRate(
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  rates: Record<string, string>,
): number | null {
  return convertedAmount("1", fromCurrency, toCurrency, rates);
}

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

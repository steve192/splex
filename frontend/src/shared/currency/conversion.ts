import type { CurrencyCode } from "../lib/currencies";

export const MANUAL_EXCHANGE_RATE_SOURCE = "manual";

function numericRate(
  currency: CurrencyCode,
  rates: Record<string, string>,
): number | null {
  const rate = Number(rates[currency]);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

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

export function formatExchangeRate(rate: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumSignificantDigits: 6 }).format(
    rate,
  );
}

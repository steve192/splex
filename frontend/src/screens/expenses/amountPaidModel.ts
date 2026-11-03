import {
  MANUAL_EXCHANGE_RATE_SOURCE,
  rateDeviation,
} from "../../shared/currency/conversion";
import { asNumber, moneyValue } from "../../shared/lib/money";
import type { Expense } from "../../shared/types/models";

export type AmountPaidFieldState = "hidden" | "singlePayerOnly" | "editable";

export const AMOUNT_PAID_WARNING_DEVIATION = 0.1;

export type RateComparison = Readonly<{
  key:
    | "expense.rateAboveOfficial"
    | "expense.rateBelowOfficial"
    | "expense.rateMatchesOfficial";
  percent: string;
  suspicious: boolean;
}>;

export function amountPaidFieldState({
  currency,
  contextCurrency,
  multiPayer,
}: Readonly<{
  currency: string;
  contextCurrency: string | null;
  multiPayer: boolean;
}>): AmountPaidFieldState {
  if (!contextCurrency || currency === contextCurrency) return "hidden";
  return multiPayer ? "singlePayerOnly" : "editable";
}

export function amountPaidPayload(
  fieldState: AmountPaidFieldState,
  amountPaid: string,
): string | null {
  const value = moneyValue(amountPaid);
  return fieldState === "editable" && value ? value : null;
}

export function isAmountPaidInvalid(
  fieldState: AmountPaidFieldState,
  amountPaid: string,
): boolean {
  const value = amountPaidPayload(fieldState, amountPaid);
  return value !== null && !(asNumber(value) > 0);
}

export function isAmountPaidExpense(
  expense: Pick<Expense, "exchange_rate_source">,
): boolean {
  return expense.exchange_rate_source === MANUAL_EXCHANGE_RATE_SOURCE;
}

export function amountPaidFormValue(
  expense: Pick<Expense, "exchange_rate_source" | "converted_amount">,
): string {
  return isAmountPaidExpense(expense) ? expense.converted_amount : "";
}

export function amountPaidRate(
  amount: string,
  amountPaid: string,
): number | null {
  const receiptAmount = asNumber(moneyValue(amount));
  const paidAmount = asNumber(moneyValue(amountPaid));
  return receiptAmount > 0 && paidAmount > 0
    ? paidAmount / receiptAmount
    : null;
}

/** True when only the receipt amount of a saved amount-paid expense was edited. */
export function amountPaidNeedsReview({
  loadedExpense,
  amount,
  amountPaid,
}: Readonly<{
  loadedExpense: Expense | null;
  amount: string;
  amountPaid: string;
}>): boolean {
  if (!loadedExpense || !isAmountPaidExpense(loadedExpense)) return false;
  return (
    asNumber(moneyValue(amountPaid)) ===
      asNumber(loadedExpense.converted_amount) &&
    asNumber(moneyValue(amount)) !== asNumber(loadedExpense.original_amount)
  );
}

export function rateComparison(
  rate: number,
  officialRate: number,
  locale: string,
): RateComparison {
  const deviation = rateDeviation(rate, officialRate);
  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(Math.abs(deviation));
  return {
    key: rateComparisonKey(deviation),
    percent,
    suspicious: Math.abs(deviation) > AMOUNT_PAID_WARNING_DEVIATION,
  };
}

function rateComparisonKey(deviation: number): RateComparison["key"] {
  // Matches the one-decimal percent display, so "0%" is never shown as above/below.
  if (Math.round(Math.abs(deviation) * 1000) === 0) {
    return "expense.rateMatchesOfficial";
  }
  return deviation > 0 ? "expense.rateAboveOfficial" : "expense.rateBelowOfficial";
}

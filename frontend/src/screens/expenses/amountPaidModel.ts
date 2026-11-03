import { MANUAL_EXCHANGE_RATE_SOURCE } from "../../shared/currency/conversion";
import type { CurrencyCode } from "../../shared/lib/currencies";
import { asNumber, moneyValue } from "../../shared/lib/money";
import type { Expense } from "../../shared/types/models";

export type AmountPaidFieldState =
  | Readonly<{ kind: "hidden" }>
  | Readonly<{
      kind: "singlePayerOnly" | "editable";
      contextCurrency: CurrencyCode;
    }>;

export type RateComparison = Readonly<{
  key:
    | "expense.rateAboveOfficial"
    | "expense.rateBelowOfficial"
    | "expense.rateMatchesOfficial";
  percent: string;
  suspicious: boolean;
}>;

const WARNING_DEVIATION = 0.1;

export function amountPaidFieldState({
  currency,
  contextCurrency,
  multiPayer,
}: Readonly<{
  currency: CurrencyCode;
  contextCurrency: CurrencyCode | null;
  multiPayer: boolean;
}>): AmountPaidFieldState {
  if (!contextCurrency || currency === contextCurrency) return { kind: "hidden" };
  return {
    kind: multiPayer ? "singlePayerOnly" : "editable",
    contextCurrency,
  };
}

export function amountPaidPayload(
  fieldState: AmountPaidFieldState,
  amountPaid: string,
): string | null {
  const value = moneyValue(amountPaid);
  return fieldState.kind === "editable" && value ? value : null;
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

/**
 * The official rate the form compares against: the one stored on the edited
 * expense while its currencies and date are unchanged, otherwise the latest one.
 */
export function formOfficialRate({
  loadedExpense,
  currency,
  contextCurrency,
  date,
  latestRate,
}: Readonly<{
  loadedExpense: Expense | null;
  currency: CurrencyCode;
  contextCurrency: CurrencyCode;
  date: string;
  latestRate: number | null;
}>): number | null {
  if (
    loadedExpense?.original_currency === currency &&
    loadedExpense.converted_currency === contextCurrency &&
    loadedExpense.date === date
  ) {
    const storedRate = isAmountPaidExpense(loadedExpense)
      ? loadedExpense.official_exchange_rate
      : loadedExpense.exchange_rate;
    if (storedRate) return asNumber(storedRate);
  }
  return latestRate;
}

export function officialEstimate(
  amount: string,
  officialRate: number | null,
): number | null {
  const receiptAmount = asNumber(moneyValue(amount));
  return officialRate !== null && receiptAmount > 0
    ? receiptAmount * officialRate
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
  const deviation = rate / officialRate - 1;
  const percentFormat = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  });
  const percent = percentFormat.format(Math.abs(deviation));
  return {
    key: rateComparisonKey(deviation, percent === percentFormat.format(0)),
    percent,
    suspicious: Math.abs(deviation) > WARNING_DEVIATION,
  };
}

function rateComparisonKey(
  deviation: number,
  roundsToZero: boolean,
): RateComparison["key"] {
  if (roundsToZero) return "expense.rateMatchesOfficial";
  return deviation > 0
    ? "expense.rateAboveOfficial"
    : "expense.rateBelowOfficial";
}

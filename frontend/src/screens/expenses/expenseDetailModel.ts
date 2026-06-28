import { asNumber } from "../../shared/lib/money";
import type { Expense } from "../../shared/types/models";

export function isConvertedExpense(expense: Expense): boolean {
  return (
    expense.original_currency !== expense.converted_currency ||
    expense.original_amount !== expense.converted_amount
  );
}

export function expensePersonalNet(
  expense: Expense,
  currentParticipantId: number | null,
): number | null {
  if (currentParticipantId == null) return null;

  const paid = expense.payments
    .filter((share) => share.participant_id === currentParticipantId)
    .reduce((sum, share) => sum + asNumber(share.amount), 0);
  const owed = expense.owed
    .filter((share) => share.participant_id === currentParticipantId)
    .reduce((sum, share) => sum + asNumber(share.amount), 0);
  return paid - owed;
}

export function expenseExchangeRateText(expense: Expense): string | null {
  if (!isConvertedExpense(expense) || !expense.exchange_rate) return null;
  return `1 ${expense.original_currency} = ${expense.exchange_rate} ${expense.converted_currency}`;
}

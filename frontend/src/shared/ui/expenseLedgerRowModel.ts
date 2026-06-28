import { formatMoney } from "../lib/money";
import { Expense } from "../types/models";

type LedgerRowTranslate = (
  key: string,
  params?: Record<string, string | number>
) => string;

export function payerLine(expense: Expense, t: LedgerRowTranslate): string {
  if (!expense.payments.length) return "";
  const names = expense.payments.map((share) => share.display_name).filter(Boolean);
  const payerNames =
    names.length <= 2
      ? names.join(", ")
      : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  return t("expense.payerLine", {
    payer: payerNames,
    amount: `${formatMoney(expense.original_amount)} ${expense.original_currency}`
  });
}

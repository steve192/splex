type Translate = (key: string) => string;

export type OptionSheet = "context" | "date" | "payer" | "split";

export type ExpenseOptionRow = Readonly<{
  label: string;
  value: string;
  sheet: OptionSheet;
}>;

export function expenseOptionRows({
  hasContext,
  date,
  payerLabel,
  splitLabel,
  t,
}: Readonly<{
  hasContext: boolean;
  date: string;
  payerLabel: string;
  splitLabel: string;
  t: Translate;
}>): ExpenseOptionRow[] {
  if (!hasContext) return [];

  return [
    {
      label: t("expense.date"),
      value: date || t("common.today"),
      sheet: "date",
    },
    { label: t("expense.paidBy"), value: payerLabel, sheet: "payer" },
    { label: t("expense.split"), value: splitLabel, sheet: "split" },
  ];
}

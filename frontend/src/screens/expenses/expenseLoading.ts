export type ExpenseLoadViewState = "loading" | "error" | "content";

export function expenseDetailViewState({
  loading,
  hasExpense,
  loadFailed
}: {
  loading: boolean;
  hasExpense: boolean;
  loadFailed: boolean;
}): ExpenseLoadViewState {
  if (hasExpense) return "content";
  if (loadFailed) return "error";
  return loading ? "loading" : "error";
}

export function expenseEditViewState({
  editing,
  loading,
  loadFailed
}: {
  editing: boolean;
  loading: boolean;
  loadFailed: boolean;
}): ExpenseLoadViewState {
  if (!editing) return "content";
  if (loadFailed) return "error";
  return loading ? "loading" : "content";
}

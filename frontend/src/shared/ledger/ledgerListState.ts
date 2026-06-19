type LedgerEmptyStateKeyOptions = {
  hasPending: boolean;
  itemCount: number;
  loadingInitial: boolean;
  searching: boolean;
};

export function ledgerEmptyStateKey({
  hasPending,
  itemCount,
  loadingInitial,
  searching
}: Readonly<LedgerEmptyStateKeyOptions>): "common.noResults" | "expense.empty" | null {
  if (itemCount > 0 || loadingInitial || hasPending) return null;
  return searching ? "common.noResults" : "expense.empty";
}

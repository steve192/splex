import { ApiClient } from "../api/client";
import { PendingMutation, syncPendingMutations } from "../sync/queue";
import { ContextType } from "../types/models";

export type PendingExpenseDraft = {
  mutationId: string;
  contextType: ContextType;
  contextId: number;
  description: string;
  amount: string;
  currency: string;
  date: string;
  createdAt: string;
  status: PendingMutation["status"];
  lastError?: string;
};

export function pendingExpenseContextKey(contextType: ContextType, contextId: number): string {
  return `${contextType}:${contextId}`;
}

function parsePendingExpense(mutation: PendingMutation): PendingExpenseDraft | null {
  const payload = mutation.payload as {
    context_type?: ContextType;
    context_id?: number;
    expense?: {
      description?: string;
      amount?: string;
      currency?: string;
      date?: string;
    };
  };

  if (!payload.context_type || !payload.context_id || mutation.type !== "create_expense") {
    return null;
  }

  return {
    mutationId: mutation.id,
    contextType: payload.context_type,
    contextId: payload.context_id,
    description: payload.expense?.description ?? "",
    amount: payload.expense?.amount ?? "0",
    currency: payload.expense?.currency ?? "EUR",
    date: payload.expense?.date ?? mutation.createdAt,
    createdAt: mutation.createdAt,
    status: mutation.status,
    lastError: mutation.lastError
  };
}

export async function listPendingExpenses(): Promise<PendingExpenseDraft[]> {
  const pendingRows = await syncPendingMutations.list();
  return pendingRows
    .map(parsePendingExpense)
    .filter((row): row is PendingExpenseDraft => Boolean(row))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function countPendingExpensesByContext(): Promise<Record<string, number>> {
  const drafts = await listPendingExpenses();
  return drafts.reduce<Record<string, number>>((counts, draft) => {
    const key = pendingExpenseContextKey(draft.contextType, draft.contextId);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

export async function pendingExpensesForContext(
  contextType: ContextType,
  contextId: number
): Promise<PendingMutation[]> {
  const pendingRows = await syncPendingMutations.list();
  return pendingRows.filter((mutation) => {
    const payload = mutation.payload as { context_type?: ContextType; context_id?: number };
    return payload?.context_type === contextType && payload?.context_id === contextId;
  });
}

export async function removePendingExpense(id: string): Promise<void> {
  await syncPendingMutations.remove(id);
}

export async function retryPendingExpenses(api: ApiClient): Promise<void> {
  await syncPendingMutations.flush(api);
}

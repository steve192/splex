import { ApiClient, ApiError } from "../../shared/api/client";
import {
  syncPendingMutations,
  type PendingMutation,
} from "../../shared/sync/queue";
import type { ContextType } from "../../shared/types/models";

export type ExpenseSaveExpense = Record<string, unknown> & {
  client_id: string;
};

export type ExpenseSavePayload = Readonly<{
  context_type: ContextType;
  context_id: number;
  expense: ExpenseSaveExpense;
}>;

export function expenseCollectionPath(
  contextType: ContextType,
  contextId: number,
): string {
  return contextType === "group"
    ? `/api/groups/${contextId}/expenses/`
    : `/api/friends/${contextId}/expenses/`;
}

export function pendingExpenseMutation({
  id,
  payload,
  createdAt,
}: Readonly<{
  id: string;
  payload: ExpenseSavePayload;
  createdAt: string;
}>): PendingMutation {
  return {
    id,
    type: "create_expense",
    payload,
    createdAt,
    status: "pending",
  };
}

export function shouldQueueOfflineCreate(
  error: unknown,
  expenseId?: number,
): boolean {
  return error instanceof ApiError && error.offline && !expenseId;
}

export async function persistExpenseSave({
  api,
  expenseId,
  pendingMutationId,
  contextType,
  contextId,
  expense,
  payload,
  createdAt,
}: Readonly<{
  api: ApiClient;
  expenseId?: number;
  pendingMutationId?: string;
  contextType: ContextType;
  contextId: number;
  expense: ExpenseSaveExpense;
  payload: ExpenseSavePayload;
  createdAt: string;
}>): Promise<void> {
  if (expenseId) {
    await api.patch(`/api/expenses/${expenseId}/`, expense);
    return;
  }
  if (pendingMutationId) {
    await syncPendingMutations.enqueue(
      pendingExpenseMutation({ id: pendingMutationId, payload, createdAt }),
    );
    return;
  }
  await api.post(expenseCollectionPath(contextType, contextId), expense);
}

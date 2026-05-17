import { ApiClient } from "../api/client";
import { PendingMutation, syncPendingMutations } from "../sync/queue";
import { ContextType } from "../types/models";

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

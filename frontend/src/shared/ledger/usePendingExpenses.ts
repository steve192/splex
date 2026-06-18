import { useCallback, useMemo, useState } from "react";

import { useAuth } from "../../features/auth/AuthContext";
import { PendingMutation } from "../sync/queue";
import {
  pendingExpensesForContext,
  removePendingExpense,
  retryPendingExpenses
} from "./pendingExpenses";

export type PendingExpenses = {
  items: PendingMutation[];
  /** Reloads the locally-queued drafts for this context. */
  refresh: () => Promise<void>;
  /** Discards a queued draft, then reloads drafts and the ledger. */
  remove: (mutationId: string) => Promise<void>;
  /** Re-attempts syncing all queued drafts, then reloads drafts and the ledger. */
  retry: () => Promise<void>;
};

/**
 * Locally-queued expense drafts for a group or friendship, shown above the
 * synced ledger. `onReload` refetches the ledger after a draft is removed or
 * synced so both lists stay in step.
 */
export function usePendingExpenses(
  contextType: "group" | "friendship",
  contextId: number,
  onReload: () => Promise<void> | void
): PendingExpenses {
  const { api } = useAuth();
  const [items, setItems] = useState<PendingMutation[]>([]);

  const refresh = useCallback(async () => {
    setItems(await pendingExpensesForContext(contextType, contextId));
  }, [contextType, contextId]);

  const remove = useCallback(
    async (mutationId: string) => {
      await removePendingExpense(mutationId);
      await Promise.all([refresh(), onReload()]);
    },
    [refresh, onReload]
  );

  const retry = useCallback(async () => {
    await retryPendingExpenses(api);
    await Promise.all([refresh(), onReload()]);
  }, [api, refresh, onReload]);

  return useMemo(() => ({ items, refresh, remove, retry }), [items, refresh, remove, retry]);
}

import { useCallback, useEffect, useRef, useState } from "react";

import {
  canStartPendingAction,
  pendingActionMatches,
} from "./pendingActionState";

export function usePendingAction<
  ActionKey extends string = string,
>() {
  const pendingRef = useRef<ActionKey | null>(null);
  const mountedRef = useRef(true);
  const [pending, setPending] = useState<ActionKey | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const updatePending = useCallback((key: ActionKey | null) => {
    pendingRef.current = key;
    if (mountedRef.current) {
      setPending(key);
    }
  }, []);

  const runPendingAction = useCallback(
    async <Result>(
      key: ActionKey,
      action: () => Promise<Result> | Result,
    ): Promise<Result | undefined> => {
      if (!canStartPendingAction(pendingRef.current)) return undefined;
      updatePending(key);
      try {
        return await action();
      } finally {
        updatePending(null);
      }
    },
    [updatePending],
  );

  const isPending = useCallback(
    (key: ActionKey) => pendingActionMatches(pending, key),
    [pending],
  );

  return {
    hasPending: pending !== null,
    isPending,
    pending,
    runPendingAction,
  };
}

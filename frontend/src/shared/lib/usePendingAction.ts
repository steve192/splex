import { useCallback, useEffect, useRef, useState } from "react";

import {
  canStartPendingAction,
  pendingActionMatches,
  PendingActionKey,
} from "./pendingActionState";

export function usePendingAction<
  ActionKey extends PendingActionKey = PendingActionKey,
>() {
  const pendingRef = useRef<ActionKey | null>(null);
  const mountedRef = useRef(true);
  const [pending, setPendingState] = useState<ActionKey | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setPending = useCallback((key: ActionKey | null) => {
    pendingRef.current = key;
    if (mountedRef.current) {
      setPendingState(key);
    }
  }, []);

  const runPendingAction = useCallback(
    async <Result>(
      key: ActionKey,
      action: () => Promise<Result> | Result,
    ): Promise<Result | undefined> => {
      if (!canStartPendingAction(pendingRef.current)) return undefined;
      setPending(key);
      try {
        return await action();
      } finally {
        setPending(null);
      }
    },
    [setPending],
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

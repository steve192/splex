import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../features/auth/AuthContext";
import { OpenSourcePayload } from "./openSourceLicensesHelpers";

type OpenSourceState = {
  payload: OpenSourcePayload | null;
  loading: boolean;
  error: string;
  reload: () => void;
};

export function useOpenSourceComponents(): OpenSourceState {
  const { api } = useAuth();
  const [payload, setPayload] = useState<OpenSourcePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    api.get<OpenSourcePayload>("/api/open-source-components/")
      .then((response) => {
        if (cancelled) return;
        setPayload(response);
      })
      .catch((loadError) => {
        if (cancelled) return;
        const message = loadError instanceof Error && loadError.message ? loadError.message : "Could not load open-source notices.";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => load(), [load]);

  return {
    payload,
    loading,
    error,
    reload: () => {
      load();
    },
  };
}
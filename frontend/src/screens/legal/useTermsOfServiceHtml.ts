import { useEffect, useState } from "react";

import { useAuth } from "../../features/auth/AuthContext";

type TermsOfServiceState = {
  html: string;
  loading: boolean;
  error: string;
  reload: () => void;
};

export function useTermsOfServiceHtml(): TermsOfServiceState {
  const { api } = useAuth();
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const baseUrl = await api.getBaseUrl();
        const response = await fetch(`${baseUrl}/api/tos/`, {
          headers: { Accept: "text/html" }
        });
        const body = await response.text();
        if (!response.ok || !body.trim()) {
          throw new Error(`Unexpected response ${response.status}`);
        }
        if (cancelled) return;
        setHtml(body);
      } catch {
        if (cancelled) return;
        setError("load_failed");
        setHtml("");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api, reloadKey]);

  return {
    html,
    loading,
    error,
    reload() {
      setReloadKey((current) => current + 1);
    }
  };
}
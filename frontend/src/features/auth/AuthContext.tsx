import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { ApiClient, tokenStorage, Tokens } from "../../shared/api/client";

type User = {
  id: number;
  email: string;
  display_name: string;
  default_currency: string;
  avatar_url: string;
  push_enabled: boolean;
};

type AuthContextValue = {
  api: ApiClient;
  user: User | null;
  tokens: Tokens | null;
  refreshUser(): Promise<void>;
  requestMagicLink(email: string, inviteToken?: string): Promise<void>;
  loginWithCode(email: string, code: string): Promise<void>;
  loginWithToken(token: string): Promise<void>;
  logout(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ api, children }: { api: ApiClient; children: ReactNode }) {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api.setTokenChangeHandler(setTokens);
  }, [api]);

  useEffect(() => {
    tokenStorage.get().then(async (stored) => {
      if (!stored) return;
      api.setTokens(stored);
      setTokens(stored);
      try {
        setUser(await api.get<User>("/api/me/"));
      } catch {
        await tokenStorage.set(null);
        api.setTokens(null);
        setTokens(null);
      }
    });
  }, [api]);

  const value = useMemo<AuthContextValue>(
    () => ({
      api,
      user,
      tokens,
      async refreshUser() {
        setUser(await api.get<User>("/api/me/"));
      },
      async requestMagicLink(email: string, inviteToken?: string) {
        await api.post("/api/auth/magic-link/", { email, invite_token: inviteToken ?? "" });
      },
      async loginWithCode(email: string, code: string) {
        const response = await api.post<{ user: User; tokens: Tokens }>("/api/auth/magic-code/", {
          email,
          code
        });
        await tokenStorage.set(response.tokens);
        api.setTokens(response.tokens);
        setTokens(response.tokens);
        setUser(response.user);
      },
      async loginWithToken(token: string) {
        const response = await api.post<{ user: User; tokens: Tokens }>("/api/auth/magic-token/", {
          token
        });
        await tokenStorage.set(response.tokens);
        api.setTokens(response.tokens);
        setTokens(response.tokens);
        setUser(response.user);
      },
      async logout() {
        const refresh = tokens?.refresh;
        await tokenStorage.set(null);
        api.setTokens(null);
        setTokens(null);
        setUser(null);
        if (refresh) {
          await api.post("/api/auth/logout/", { refresh }).catch(() => undefined);
        }
      }
    }),
    [api, tokens, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return value;
}

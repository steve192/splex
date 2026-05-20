import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ApiClient, ApiError, tokenStorage, Tokens } from "../../shared/api/client";

type User = {
  id: number;
  email: string;
  display_name: string;
  default_currency: string;
  avatar_url: string;
  push_enabled: boolean;
  locale: string;
};

type AuthContextValue = {
  api: ApiClient;
  user: User | null;
  tokens: Tokens | null;
  initialized: boolean;
  refreshUser(): Promise<void>;
  requestMagicLink(email: string, inviteToken?: string): Promise<void>;
  loginWithCode(email: string, code: string): Promise<void>;
  loginWithToken(token: string): Promise<void>;
  logout(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const USER_STORAGE_KEY = "splex.user";

async function getStoredUser(): Promise<User | null> {
  const raw = await AsyncStorage.getItem(USER_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

async function setStoredUser(user: User | null): Promise<void> {
  if (user) {
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    return;
  }
  await AsyncStorage.removeItem(USER_STORAGE_KEY);
}

export function AuthProvider({ api, children }: { api: ApiClient; children: ReactNode }) {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    api.setTokenChangeHandler(setTokens);
  }, [api]);

  useEffect(() => {
    tokenStorage.get().then(async (stored) => {
      if (!stored) {
        setInitialized(true);
        return;
      }

      const cachedUser = await getStoredUser();
      api.setTokens(stored);
      setTokens(stored);
      if (cachedUser) {
        setUser(cachedUser);
      }
      try {
        const freshUser = await api.get<User>("/api/me/");
        setUser(freshUser);
        await setStoredUser(freshUser);
      } catch (error) {
        if (error instanceof ApiError && error.offline) {
          setInitialized(true);
          return;
        }
        await tokenStorage.set(null);
        await setStoredUser(null);
        api.setTokens(null);
        setTokens(null);
        setUser(null);
      } finally {
        setInitialized(true);
      }
    });
  }, [api]);

  const value = useMemo<AuthContextValue>(
    () => ({
      api,
      user,
      tokens,
      initialized,
      async refreshUser() {
        const freshUser = await api.get<User>("/api/me/");
        setUser(freshUser);
        await setStoredUser(freshUser);
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
        await setStoredUser(response.user);
        api.setTokens(response.tokens);
        setTokens(response.tokens);
        setUser(response.user);
      },
      async loginWithToken(token: string) {
        const response = await api.post<{ user: User; tokens: Tokens }>("/api/auth/magic-token/", {
          token
        });
        await tokenStorage.set(response.tokens);
        await setStoredUser(response.user);
        api.setTokens(response.tokens);
        setTokens(response.tokens);
        setUser(response.user);
      },
      async logout() {
        const refresh = tokens?.refresh;
        await tokenStorage.set(null);
        await setStoredUser(null);
        api.setTokens(null);
        setTokens(null);
        setUser(null);
        if (refresh) {
          await api.post("/api/auth/logout/", { refresh }).catch(() => undefined);
        }
      }
    }),
    [api, initialized, tokens, user]
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

import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ApiClient, ApiError, tokenStorage, Tokens } from "../../shared/api/client";
import { DEMO_TOKENS, DEMO_USER } from "../../shared/demo/demoFixtures";
import { loadPersistedDemoMode } from "../../shared/demo/demoMode";
import { useI18n } from "../../shared/i18n/I18nContext";
import {
  deregisterPushOnLogout,
  resetPushPreferenceOnLogin
} from "../../shared/notifications/registration";
import { runPostLoginBootstrap } from "./postLoginBootstrap";

type User = {
  id: number;
  email: string;
  display_name: string;
  default_currency: string;
  avatar_url: string;
  push_enabled: boolean;
  locale: string;
  location_tracking_enabled: boolean;
};

type AuthContextValue = {
  api: ApiClient;
  user: User | null;
  tokens: Tokens | null;
  initialized: boolean;
  refreshUser(): Promise<void>;
  requestMagicLink(email: string, inviteToken?: string, locale?: string): Promise<void>;
  loginWithCode(email: string, code: string): Promise<void>;
  loginWithToken(token: string): Promise<void>;
  loginWithGoogle(idToken: string): Promise<void>;
  loginAsDemo(): Promise<void>;
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

export function AuthProvider({ api, children }: Readonly<{ api: ApiClient; children: ReactNode }>) {
  const { locale } = useI18n();
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    api.setTokenChangeHandler(setTokens);
  }, [api]);

  useEffect(() => {
    (async () => {
      if (await loadPersistedDemoMode()) {
        // Restore the demo session without contacting the backend.
        await api.setDemoMode(true);
        api.setTokens(DEMO_TOKENS);
        setTokens(DEMO_TOKENS);
        setUser(DEMO_USER);
        await setStoredUser(DEMO_USER);
        setInitialized(true);
        return;
      }
      const stored = await tokenStorage.get();
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
      setInitialized(true);
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
    })();
  }, [api]);

  const value = useMemo<AuthContextValue>(() => {
    async function refreshUser() {
      const freshUser = await api.get<User>("/api/me/");
      setUser(freshUser);
      await setStoredUser(freshUser);
    }

    function runAfterLogin(loggedInUser: User) {
      runPostLoginBootstrap({ api, user: loggedInUser, locale, refreshUser }).catch(() => undefined);
    }

    // Shared tail of every fresh-login flow. Clearing the device push
    // preference first means the post-login bootstrap re-enables
    // notifications even if they were explicitly turned off before.
    async function completeLogin(response: { user: User; tokens: Tokens }) {
      await resetPushPreferenceOnLogin();
      await tokenStorage.set(response.tokens);
      await setStoredUser(response.user);
      api.setTokens(response.tokens);
      setTokens(response.tokens);
      setUser(response.user);
      runAfterLogin(response.user);
    }

    return {
      api,
      user,
      tokens,
      initialized,
      refreshUser,
      async requestMagicLink(email: string, inviteToken?: string, locale?: string) {
        await api.post("/api/auth/magic-link/", {
          email,
          invite_token: inviteToken ?? "",
          locale: locale ?? ""
        });
      },
      async loginWithCode(email: string, code: string) {
        const response = await api.post<{ user: User; tokens: Tokens }>("/api/auth/magic-code/", {
          email,
          code
        });
        await completeLogin(response);
      },
      async loginWithToken(token: string) {
        const response = await api.post<{ user: User; tokens: Tokens }>("/api/auth/magic-token/", {
          token
        });
        await completeLogin(response);
      },
      async loginWithGoogle(idToken: string) {
        const response = await api.post<{ user: User; tokens: Tokens }>("/api/auth/google/", {
          id_token: idToken
        });
        await completeLogin(response);
      },
      async loginAsDemo() {
        await api.setDemoMode(true);
        await tokenStorage.set(DEMO_TOKENS);
        await setStoredUser(DEMO_USER);
        api.setTokens(DEMO_TOKENS);
        setTokens(DEMO_TOKENS);
        setUser(DEMO_USER);
        runAfterLogin(DEMO_USER);
      },
      async logout() {
        const refresh = tokens?.refresh;
        const wasDemoMode = api.isDemoMode();
        if (wasDemoMode) {
          await api.setDemoMode(false);
        } else {
          // Disable this device's push subscription and blacklist the refresh
          // token while credentials are still valid, then wipe local state.
          await deregisterPushOnLogout(api);
          if (refresh) {
            await api.post("/api/auth/logout/", { refresh }).catch(() => undefined);
          }
        }
        await tokenStorage.set(null);
        await setStoredUser(null);
        api.setTokens(null);
        setTokens(null);
        setUser(null);
      }
    };
  }, [api, initialized, locale, tokens, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return value;
}

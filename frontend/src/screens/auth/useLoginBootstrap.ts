import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { consumeGoogleOAuthResponse } from "../../shared/auth/googleOAuthWeb";
import {
  clearUrlQuery,
  inviteDebug,
  inviteTokenFromCurrentUrl,
  inviteTokenFromUrl,
  PENDING_INVITE_STORAGE_KEY,
  tokenFromCurrentUrl,
  tokenFromUrl,
} from "../../shared/lib/inviteLinks";
import { apiWriteErrorMessage } from "../../shared/lib/apiErrors";

import {
  normalizeLoginConfig,
  resolveLoginToken,
  type LoginConfig,
  type LoginProviderSettings,
} from "./loginHelpers";

type LoginApi = {
  get: <T>(path: string) => Promise<T>;
  getBaseUrl: () => Promise<string>;
};

type LoginBootstrapArgs = Readonly<{
  api: LoginApi;
  loginWithGoogle: (idToken: string) => Promise<unknown>;
  loginWithToken: (token: string) => Promise<unknown>;
  routeToken: string | undefined;
  routeInviteToken: string | undefined;
  setLoading: (value: boolean) => void;
  notifyError: (message: string) => void;
  notifyInfo: (message: string) => void;
  t: (key: string) => string;
}>;

export type LoginProvidersState = Readonly<{
  googleClientId: string | null;
  googleAndroidClientId: string | undefined;
  demoModeEnabled: boolean;
  providersResolved: boolean;
  backendUrl: string;
  setBackendUrl: (value: string) => void;
}>;

async function loadLoginProviders(
  api: LoginApi,
  apply: (settings: LoginProviderSettings) => void,
  markResolved: () => void
) {
  try {
    apply(normalizeLoginConfig(await api.get<LoginConfig>("/api/login/config/")));
  } catch {
    // Backend unreachable - assume demo mode is on so the demo path stays
    // available offline. Other login providers stay hidden by default.
    apply({ googleClientId: null, googleAndroidClientId: undefined, demoModeEnabled: true });
  } finally {
    markResolved();
  }
}

function hydrateAndroidBackendUrl(api: LoginApi, setBackendUrl: (value: string) => void) {
  if (Platform.OS !== "android") {
    return;
  }
  api.getBaseUrl().then(setBackendUrl).catch(() => undefined);
}

async function finishGoogleRedirectLogin(
  loginWithGoogle: (idToken: string) => Promise<unknown>,
  setLoading: (value: boolean) => void,
  onError: (error: unknown) => void
) {
  if (Platform.OS !== "web") {
    return;
  }

  const googleResponse = consumeGoogleOAuthResponse();
  if (!googleResponse) {
    return;
  }

  setLoading(true);
  try {
    await loginWithGoogle(googleResponse.idToken);
  } catch (error) {
    onError(error);
  } finally {
    setLoading(false);
  }
}

async function nativeInitialUrl(): Promise<string> {
  if (Platform.OS === "web") {
    return "";
  }
  return (await Linking.getInitialURL()) ?? "";
}

async function persistPendingInvite(
  routeInviteToken: string | undefined,
  initialUrl: string,
  onStored: () => void
) {
  inviteDebug("login screen mounted");
  const inviteToken = routeInviteToken || inviteTokenFromCurrentUrl() || inviteTokenFromUrl(initialUrl);
  if (!inviteToken) {
    return;
  }

  inviteDebug("login screen storing pending invite token");
  await AsyncStorage.setItem(PENDING_INVITE_STORAGE_KEY, inviteToken).catch(() => undefined);
  onStored();
}

async function loginWithMagicToken(
  token: string,
  loginWithToken: (token: string) => Promise<unknown>,
  setLoading: (value: boolean) => void,
  onError: (error: unknown) => void
) {
  inviteDebug("login screen found magic token; attempting login");
  setLoading(true);
  try {
    await loginWithToken(token);
    inviteDebug("magic token login succeeded");
    clearUrlQuery();
  } catch (error) {
    inviteDebug("magic token login failed", error);
    onError(error);
  } finally {
    setLoading(false);
  }
}

export function useLoginBootstrap({
  api,
  loginWithGoogle,
  loginWithToken,
  routeToken,
  routeInviteToken,
  setLoading,
  notifyError,
  notifyInfo,
  t,
}: LoginBootstrapArgs): LoginProvidersState {
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [googleAndroidClientId, setGoogleAndroidClientId] = useState<string | undefined>(undefined);
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);
  const [providersResolved, setProvidersResolved] = useState(false);
  const [backendUrl, setBackendUrl] = useState("");

  useEffect(() => {
    let cancelled = false;

    hydrateAndroidBackendUrl(api, setBackendUrl);
    loadLoginProviders(
      api,
      (settings) => {
        setGoogleClientId(settings.googleClientId);
        setGoogleAndroidClientId(settings.googleAndroidClientId);
        setDemoModeEnabled(settings.demoModeEnabled);
      },
      () => setProvidersResolved(true)
    ).catch(() => undefined);
    finishGoogleRedirectLogin(loginWithGoogle, setLoading, (error) =>
      notifyError(apiWriteErrorMessage(error, t))
    ).catch(() => undefined);

    async function finishLinkBootstrap() {
      const initialUrl = await nativeInitialUrl();
      await persistPendingInvite(routeInviteToken, initialUrl, () =>
        notifyInfo(t("invite.loginRequired"))
      );
      if (cancelled) return;
      const token = resolveLoginToken(
        routeToken,
        tokenFromCurrentUrl() || tokenFromUrl(initialUrl)
      );
      if (token) {
        await loginWithMagicToken(token, loginWithToken, setLoading, (error) =>
          notifyError(apiWriteErrorMessage(error, t))
        );
      }
    }

    finishLinkBootstrap().catch(() => undefined);

    return () => {
      cancelled = true;
    };
    // Mount-only: provider config, the OAuth-redirect handoff, pending-invite
    // capture and magic-token login should each run exactly once on entry.
  }, []);

  return {
    googleClientId,
    googleAndroidClientId,
    demoModeEnabled,
    providersResolved,
    backendUrl,
    setBackendUrl,
  };
}

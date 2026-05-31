export type LoginConfig = {
  google: { client_id: string | null; android_client_id: string | null };
  demo_mode_enabled?: boolean;
};

export type LoginProviderSettings = {
  googleClientId: string | null;
  googleAndroidClientId: string | undefined;
  demoModeEnabled: boolean;
};

export type LoginMessage = { text: string; tone: "error" | "info" };

export const normalizeLoginConfig = (
  config: LoginConfig | null | undefined
): LoginProviderSettings => ({
  googleClientId: config?.google?.client_id ?? null,
  googleAndroidClientId: config?.google?.android_client_id ?? undefined,
  demoModeEnabled: Boolean(config?.demo_mode_enabled)
});

export const resolveLoginToken = (
  routeToken: string | undefined,
  urlToken: string | null
): string | null => routeToken ?? urlToken ?? null;

export const shouldShowDemoMode = (
  providersResolved: boolean,
  demoModeEnabled: boolean
): boolean => providersResolved && demoModeEnabled;

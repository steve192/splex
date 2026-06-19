import type { ApiClient } from "../../shared/api/client";
import { bootstrapLocationAfterLogin } from "../../shared/location/locationService";
import { runBestEffortSequentially } from "../../shared/lib/runBestEffortSequentially";
import { bootstrapPushAfterLogin } from "../../shared/notifications/registration";

type PostLoginUser = {
  locale: string;
  location_tracking_enabled: boolean;
};

type PostLoginBootstrapOptions = {
  api: ApiClient;
  user: PostLoginUser;
  locale: string;
  refreshUser(): Promise<void>;
};

export async function runPostLoginBootstrap({
  api,
  user,
  locale,
  refreshUser
}: PostLoginBootstrapOptions): Promise<void> {
  await runBestEffortSequentially([
    () => bootstrapPushAfterLogin(api),
    () => bootstrapLocationAfterLogin(user.location_tracking_enabled, api),
    () => refreshUser()
  ]);

  if (user.locale !== locale) {
    api.patch("/api/me/", { locale }).catch(() => undefined);
  }
}

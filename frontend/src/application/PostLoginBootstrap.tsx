/**
 * Runs once-per-app-launch tasks that require an authenticated user:
 *   - register this device for push notifications if the user previously opted in
 *     (or if the OS permission is already granted on first launch)
 *   - sync the device locale to the backend if it differs from what the server has,
 *     so push notification text is translated using the latest language choice
 *
 * Renders nothing.
 */
import { useEffect, useRef } from "react";

import { useAuth } from "../features/auth/AuthContext";
import { useI18n } from "../shared/i18n/I18nContext";
import { bootstrapPushOnStartup } from "../shared/notifications/registration";

export function PostLoginBootstrap() {
  const { api, user, initialized } = useAuth();
  const { locale } = useI18n();
  const didBootstrap = useRef(false);

  useEffect(() => {
    if (!initialized || !user) return;
    if (didBootstrap.current) return;
    didBootstrap.current = true;

    bootstrapPushOnStartup(api).catch(() => undefined);

    if (user.locale !== locale) {
      api.patch("/api/me/", { locale }).catch(() => undefined);
    }
  }, [api, initialized, user, locale]);

  return null;
}

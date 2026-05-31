/**
 * Runs once-per-app-launch tasks that require an authenticated user:
 *   - register this device for push notifications if the user previously opted in
 *     (or if the OS permission is already granted on first launch)
 *   - request location permission if the user has location tracking enabled
 *   - sync the device locale to the backend if it differs from what the server has,
 *     so push notification text is translated using the latest language choice
 *   - warm the offline cache for resources that some screens read but never
 *     fetch themselves (so a user who only browses the overview still has
 *     groups/friends available offline when opening activity or add-expense)
 *
 * Renders nothing.
 */
import { useEffect, useRef } from "react";

import { useAuth } from "../features/auth/AuthContext";
import { useI18n } from "../shared/i18n/I18nContext";
import { bootstrapPushOnStartup } from "../shared/notifications/registration";
import { bootstrapLocationOnStartup } from "../shared/location/locationService";
import { prefetchPaths } from "../shared/lib/offlineCache";
import { runPermissionBootstraps } from "./runPermissionBootstraps";

export function PostLoginBootstrap() {
  const { api, user, initialized, refreshUser } = useAuth();
  const { locale } = useI18n();
  const didBootstrap = useRef(false);

  useEffect(() => {
    if (!initialized) return;
    if (!user) {
      // Reset so the next login re-runs the bootstrap (e.g. after logout + re-login
      // in the same session, or when a different account logs in on the same device).
      didBootstrap.current = false;
      return;
    }
    if (didBootstrap.current) return;
    didBootstrap.current = true;

    // Notification and location permission prompts must not overlap: Android
    // silently denies a runtime-permission request made while another dialog is
    // open, so a fresh login (location tracking defaults on) would lose the
    // notification prompt to the location one. Run them in sequence; refresh the
    // user afterwards so a location-permission denial that disabled tracking
    // server-side is reflected locally.
    runPermissionBootstraps([
      () => bootstrapPushOnStartup(api),
      () => bootstrapLocationOnStartup(user.location_tracking_enabled, api),
      () => refreshUser()
    ]).catch(() => undefined);
    prefetchPaths(api, ["/api/groups/", "/api/friends/", "/api/overview/"]).catch(() => undefined);

    if (user.locale !== locale) {
      api.patch("/api/me/", { locale }).catch(() => undefined);
    }
  }, [api, initialized, user, locale, refreshUser]);

  return null;
}

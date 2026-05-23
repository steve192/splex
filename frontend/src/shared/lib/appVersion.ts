import { Platform } from "react-native";

import type { TranslateFn } from "../i18n/I18nContext";

/**
 * Returns a footer-friendly label describing the running app version.
 *
 * - On web (PWA) there is no separate native binary, so we just show the
 *   bundled `expo.version` once.
 * - On native, we show the current (post-OTA) version and, when it differs,
 *   the native APK's baked-in version alongside it so users can tell whether
 *   they're running the original install or a delivered OTA update.
 */
export function appVersionLabel(t: TranslateFn): string {
  if (Platform.OS === "web") {
    const Constants = require("expo-constants").default as typeof import("expo-constants").default;
    const version = Constants.expoConfig?.version ?? "";
    return version ? t("about.version", { version }) : "";
  }

  const Constants = require("expo-constants").default as typeof import("expo-constants").default;
  const current = Constants.expoConfig?.version ?? "";
  const native = Constants.nativeApplicationVersion ?? "";

  if (!current && !native) return "";
  if (!native || native === current) return t("about.version", { version: current || native });
  return t("about.versionWithBuild", { version: current, build: native });
}

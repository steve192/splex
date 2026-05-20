/**
 * Checks for an `expo-updates` OTA update on startup and shows a snackbar with
 * "Update" / "Dismiss" actions. On native, taps fetch + reload the new bundle.
 * On web, expo-updates is a no-op so this component renders nothing.
 */
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Snackbar } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";

declare const require: (moduleName: string) => unknown;

export function UpdateSnackbar() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let cancelled = false;
    (async () => {
      try {
        const Updates = require("expo-updates") as typeof import("expo-updates");
        if (!Updates.isEnabled) return;
        const check = await Updates.checkForUpdateAsync();
        if (cancelled) return;
        if (check.isAvailable) {
          setVisible(true);
        }
      } catch {
        // Update server unreachable; nothing to show.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function applyUpdate() {
    setApplying(true);
    try {
      const Updates = require("expo-updates") as typeof import("expo-updates");
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setApplying(false);
      setVisible(false);
    }
  }

  if (Platform.OS === "web") return null;

  return (
    <Snackbar
      visible={visible}
      onDismiss={() => setVisible(false)}
      duration={Number.POSITIVE_INFINITY}
      action={{
        label: applying ? t("updates.applying") : t("updates.apply"),
        onPress: applyUpdate,
        disabled: applying
      }}
    >
      {t("updates.available")}
    </Snackbar>
  );
}

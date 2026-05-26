import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Surface, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { PwaIosInstructionsDialog } from "./PwaIosInstructionsDialog";
import { usePwaInstallPrompt } from "./usePwaInstallPrompt";

/**
 * Bottom-anchored banner that invites the user to install the PWA. Visible
 * when the app is installable (Chromium has fired `beforeinstallprompt` OR we
 * detect iOS Safari), the app is not already running as a standalone PWA, and
 * the user hasn't asked us to stop. The "Install" button either triggers the
 * browser's native install dialog (Chromium) or opens an instructions dialog
 * for the Share → Add to Home Screen flow (iOS Safari).
 */
export function PwaInstallPrompt() {
  const { t } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { available, installMethod, install, dismiss, dontAskAgain } = usePwaInstallPrompt();
  const [iosDialogVisible, setIosDialogVisible] = useState(false);

  function handleInstall() {
    if (installMethod === "ios-safari") {
      setIosDialogVisible(true);
      return;
    }
    install();
  }

  // Only invite installation for signed-in users - the login screen shouldn't
  // be the first impression to push an install on. This also covers
  // returning-while-logged-in: the persisted user is restored on app start.
  if (!user || !available) {
    // The iOS dialog can still be open after the banner dismisses itself.
    return (
      <PwaIosInstructionsDialog
        visible={iosDialogVisible}
        onDismiss={() => setIosDialogVisible(false)}
      />
    );
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      <Surface
        mode="elevated"
        elevation={4}
        style={[styles.surface, { backgroundColor: theme.colors.elevation.level3 }]}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.iconFrame,
              { backgroundColor: theme.colors.primaryContainer }
            ]}
          >
            <MaterialCommunityIcons
              name="download"
              size={24}
              color={theme.colors.onPrimaryContainer}
            />
          </View>
          <View style={styles.headerText}>
            <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              {t("pwa.install.title")}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {t("pwa.install.body")}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Button mode="text" onPress={dontAskAgain} compact>
            {t("pwa.install.dontAsk")}
          </Button>
          <Button mode="text" onPress={dismiss} compact>
            {t("pwa.install.notNow")}
          </Button>
          <Button mode="contained" onPress={handleInstall} icon="download" compact>
            {t("pwa.install.install")}
          </Button>
        </View>
      </Surface>
      <PwaIosInstructionsDialog
        visible={iosDialogVisible}
        onDismiss={() => setIosDialogVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 12
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12
  },
  headerText: {
    flex: 1,
    gap: 2
  },
  iconFrame: {
    alignItems: "center",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  surface: {
    alignSelf: "center",
    borderRadius: 16,
    maxWidth: 560,
    padding: 16,
    width: "100%"
  },
  wrapper: {
    bottom: 0,
    left: 0,
    paddingHorizontal: 12,
    position: "absolute",
    right: 0
  }
});

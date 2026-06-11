import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";

/**
 * Walks the user through the iOS Safari "Add to Home Screen" flow. iOS has no
 * programmatic install API, so this is the closest we can offer to the
 * Chromium `beforeinstallprompt.prompt()` dialog.
 */
export function PwaIosInstructionsDialog({
  visible,
  onDismiss
}: Readonly<{
  visible: boolean;
  onDismiss(): void;
}>) {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{t("pwa.install.iosTitle")}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={styles.intro}>
            {t("pwa.install.iosIntro")}
          </Text>
          <View style={styles.step}>
            <View
              style={[
                styles.iconFrame,
                { backgroundColor: theme.colors.primaryContainer }
              ]}
            >
              <MaterialCommunityIcons
                name="export-variant"
                size={24}
                color={theme.colors.onPrimaryContainer}
              />
            </View>
            <Text variant="bodyMedium" style={styles.stepText}>
              {t("pwa.install.iosStep1")}
            </Text>
          </View>
          <View style={styles.step}>
            <View
              style={[
                styles.iconFrame,
                { backgroundColor: theme.colors.primaryContainer }
              ]}
            >
              <MaterialCommunityIcons
                name="plus-box-outline"
                size={24}
                color={theme.colors.onPrimaryContainer}
              />
            </View>
            <Text variant="bodyMedium" style={styles.stepText}>
              {t("pwa.install.iosStep2")}
            </Text>
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t("common.dismiss")}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  iconFrame: {
    alignItems: "center",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  intro: {
    marginBottom: 16
  },
  step: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginTop: 12
  },
  stepText: {
    flex: 1
  }
});

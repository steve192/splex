import { View } from "react-native";
import { ActivityIndicator, Button, Text, useTheme } from "react-native-paper";

import { styles } from "../../shared/ui/styles";
import { useI18n } from "../../shared/i18n/I18nContext";
import { useTermsOfServiceHtml } from "./useTermsOfServiceHtml";

const IFrame = "iframe" as any;

export function TermsOfServiceScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const { html, loading, error, reload } = useTermsOfServiceHtml();

  if (loading) {
    return (
      <View style={[styles.flex, styles.emptyStateContent, { backgroundColor: theme.colors.background }]}> 
        <ActivityIndicator />
        <Text>{t("tos.loading")}</Text>
      </View>
    );
  }

  if (error || !html) {
    return (
      <View style={[styles.flex, styles.emptyStateContent, { backgroundColor: theme.colors.background }]}> 
        <Text>{t("tos.loadFailed")}</Text>
        <Button mode="contained" onPress={reload}>{t("tos.retry")}</Button>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}> 
      <IFrame
        srcDoc={html}
        title={t("tos.title")}
        style={{ border: 0, flex: 1, width: "100%" }}
      />
    </View>
  );
}
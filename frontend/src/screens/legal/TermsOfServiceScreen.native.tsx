import { View } from "react-native";
import { ActivityIndicator, Button, Text, useTheme } from "react-native-paper";
import { WebView } from "react-native-webview";

import { useI18n } from "../../shared/i18n/I18nContext";
import { styles } from "../../shared/ui/styles";
import { useTermsOfServiceHtml } from "./useTermsOfServiceHtml";

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

  return <WebView source={{ html }} style={styles.flex} />;
}
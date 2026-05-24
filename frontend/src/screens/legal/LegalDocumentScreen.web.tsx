import { View } from "react-native";
import { ActivityIndicator, Button, Text, useTheme } from "react-native-paper";

import { styles } from "../../shared/ui/styles";
import { useI18n } from "../../shared/i18n/I18nContext";
import { LegalDocumentKind } from "../../shared/legal/openTermsOfService";
import { useLegalDocumentHtml } from "./useTermsOfServiceHtml";

const IFrame = "iframe" as any;

type Props = {
  kind: LegalDocumentKind;
};

export function LegalDocumentScreen({ kind }: Props) {
  const { t } = useI18n();
  const theme = useTheme();
  const { html, loading, error, reload } = useLegalDocumentHtml(kind);
  const titleKey = `legal.${kind}.title` as const;
  const loadingKey = `legal.${kind}.loading` as const;
  const failedKey = `legal.${kind}.loadFailed` as const;

  if (loading) {
    return (
      <View style={[styles.flex, styles.emptyStateContent, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator />
        <Text>{t(loadingKey)}</Text>
      </View>
    );
  }

  if (error || !html) {
    return (
      <View style={[styles.flex, styles.emptyStateContent, { backgroundColor: theme.colors.background }]}>
        <Text>{t(failedKey)}</Text>
        <Button mode="contained" onPress={reload}>{t("legal.retry")}</Button>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <IFrame
        srcDoc={html}
        title={t(titleKey)}
        style={{ border: 0, flex: 1, width: "100%" }}
      />
    </View>
  );
}

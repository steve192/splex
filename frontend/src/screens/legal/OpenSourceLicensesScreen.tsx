import { Linking, View } from "react-native";
import { ActivityIndicator, Button, Card, List, Text, useTheme } from "react-native-paper";

import { useI18n } from "../../shared/i18n/I18nContext";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";
import { componentSummary, visibleSections } from "./openSourceLicensesHelpers";
import { useOpenSourceComponents } from "./useOpenSourceComponents";

function openHomepage(url: string) {
  Linking.openURL(url).catch(() => undefined);
}

export function OpenSourceLicensesScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const { payload, loading, error, reload } = useOpenSourceComponents();

  if (loading) {
    return (
      <View style={[styles.flex, styles.emptyStateContent, { backgroundColor: theme.colors.background }]}> 
        <ActivityIndicator />
        <Text>{t("legal.openSource.loading")}</Text>
      </View>
    );
  }

  if (error || !payload) {
    return (
      <View style={[styles.flex, styles.emptyStateContent, { backgroundColor: theme.colors.background }]}> 
        <Text>{t("legal.openSource.loadFailed")}</Text>
        <Button mode="contained" onPress={reload}>{t("legal.retry")}</Button>
      </View>
    );
  }

  return (
    <Screen topInset>
      <Text variant="headlineSmall">{t("legal.openSource.title")}</Text>
      <Card mode="elevated">
        <Card.Content style={styles.gap}>
          <Text variant="titleMedium">{payload.app.name}</Text>
          <Text variant="bodyMedium">{payload.app.license}</Text>
          {payload.app.copyright ? <Text variant="bodySmall">{payload.app.copyright}</Text> : null}
          {payload.app.thirdPartyNotice ? <Text variant="bodySmall">{payload.app.thirdPartyNotice}</Text> : null}
          {payload.app.licenseText ? (
            <List.Accordion
              title={payload.app.license}
              description={t("legal.openSource.projectLicenseTitle")}
            >
              <Text variant="bodySmall">{payload.app.licenseText}</Text>
            </List.Accordion>
          ) : null}
        </Card.Content>
      </Card>
      {visibleSections(payload.sections).map((section) => (
        <View key={section.id} style={styles.listSection}>
          <Text variant="titleLarge">{section.title}</Text>
          {section.components.map((component) => (
            <List.Accordion
              key={`${section.id}-${component.name}`}
              title={component.name}
              description={componentSummary(component)}
            >
              <View style={[styles.gap, { paddingHorizontal: 16, paddingBottom: 16 }]}> 
                <Text variant="bodySmall">{t("legal.openSource.license")}: {component.license || "UNKNOWN"}</Text>
                {component.author ? <Text variant="bodySmall">{t("legal.openSource.author")}: {component.author}</Text> : null}
                {component.homepage ? (
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.primary }}
                    onPress={() => openHomepage(component.homepage || "")}
                  >
                    {t("legal.openSource.homepage")}: {component.homepage}
                  </Text>
                ) : null}
                {component.noticeText ? (
                  <List.Accordion title={t("legal.openSource.notice") }>
                    <Text variant="bodySmall">{component.noticeText}</Text>
                  </List.Accordion>
                ) : null}
                {component.licenseText ? (
                  <List.Accordion title={t("legal.openSource.licenseText") }>
                    <Text variant="bodySmall">{component.licenseText}</Text>
                  </List.Accordion>
                ) : null}
              </View>
            </List.Accordion>
          ))}
        </View>
      ))}
    </Screen>
  );
}
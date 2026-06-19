import { ReactNode, useState } from "react";
import { Linking, View } from "react-native";
import {
  Button,
  Card,
  HelperText,
  List,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { useSnackbar } from "../../shared/feedback/SnackbarContext";
import { TranslateFn, useI18n } from "../../shared/i18n/I18nContext";
import { ApiError } from "../../shared/api/client";
import { apiWriteErrorMessage } from "../../shared/lib/apiErrors";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

type ImportSummary = {
  groups_created: number;
  expenses_imported: number;
  settlements_imported: number;
  skipped_expenses: number;
};

type ImportResponse = { summary: ImportSummary };

type Step = {
  key: string;
  /** URL substituted for `{link}` in the translation, if any. */
  link?: string;
};

const STEPS: Step[] = [
  {
    key: "splitwiseImport.step1",
    link: "https://secure.splitwise.com/apps/new",
  },
  { key: "splitwiseImport.step2" },
  { key: "splitwiseImport.step3", link: "https://splitwise.com/" },
  { key: "splitwiseImport.step4" },
  { key: "splitwiseImport.step5" },
  { key: "splitwiseImport.step6" },
];

const LINK_PLACEHOLDER = "{link}";

/** Render a translation template that may contain a single `{link}` placeholder,
 * replacing it with a tappable, theme-coloured link. */
function renderStepText(
  t: TranslateFn,
  step: Step,
  linkColor: string,
): ReactNode {
  if (!step.link) {
    return t(step.key);
  }
  const template = t(step.key);
  const parts = template.split(LINK_PLACEHOLDER);
  if (parts.length === 1) {
    return template;
  }
  return (
    <>
      {parts[0]}
      <Text
        onPress={() => Linking.openURL(step.link as string)}
        style={{ color: linkColor, textDecorationLine: "underline" }}
      >
        {step.link}
      </Text>
      {parts[1]}
    </>
  );
}

export function SplitwiseImportScreen() {
  const { t } = useI18n();
  const { api } = useAuth();
  const { showSnackbar } = useSnackbar();
  const theme = useTheme();
  const [apiKey, setApiKey] = useState("");
  const [importFriends, setImportFriends] = useState(false);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleImport() {
    if (!apiKey.trim() || running) return;
    setRunning(true);
    setSummary(null);
    try {
      const result = await api.post<ImportResponse>("/api/imports/splitwise/", {
        api_key: apiKey.trim(),
        import_friends_as_groups: importFriends,
      });
      setSummary(result.summary);
      setApiKey("");
    } catch (error) {
      let message: string;
      if (error instanceof ApiError && error.status === 401) {
        message = t("splitwiseImport.invalidKey");
      } else if (error instanceof ApiError && error.offline) {
        message = apiWriteErrorMessage(error, t);
      } else if (error instanceof Error && error.message) {
        message = error.message;
      } else {
        message = t("common.error");
      }
      showSnackbar(message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Screen>
      <Text variant="headlineSmall">{t("splitwiseImport.title")}</Text>
      <Card mode="elevated">
        <Card.Content style={styles.gap}>
          <View style={styles.inline}>
            <Text variant="titleMedium" style={styles.flex}>
              {t("splitwiseImport.howToTitle")}
            </Text>
          </View>
          <Text variant="bodyMedium">{t("splitwiseImport.intro")}</Text>
          <View style={{ gap: 12, marginTop: 4 }}>
            {STEPS.map((step, index) => (
              <View
                key={step.key}
                style={{
                  flexDirection: "row",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.colors.primaryContainer,
                    borderRadius: 14,
                    height: 28,
                    justifyContent: "center",
                    width: 28,
                  }}
                >
                  <Text
                    variant="labelLarge"
                    style={{
                      color: theme.colors.onPrimaryContainer,
                      fontWeight: "700",
                    }}
                  >
                    {index + 1}
                  </Text>
                </View>
                <Text variant="bodyMedium" style={{ flex: 1, lineHeight: 22 }}>
                  {renderStepText(t, step, theme.colors.primary)}
                </Text>
              </View>
            ))}
          </View>
          <HelperText type="info" style={{ marginTop: 4 }}>
            {t("splitwiseImport.privacyNote")}
          </HelperText>
        </Card.Content>
      </Card>
      <Card mode="elevated">
        <Card.Content style={styles.gap}>
          <Text variant="titleMedium">
            {t("splitwiseImport.friendsAsGroups.title")}
          </Text>
          <Text variant="bodyMedium">
            {t("splitwiseImport.friendsAsGroups.explanation")}
          </Text>
          <List.Item
            title={t("splitwiseImport.friendsAsGroups.toggleTitle")}
            description={t("splitwiseImport.friendsAsGroups.toggleDescription")}
            right={() => (
              <Switch
                value={importFriends}
                onValueChange={setImportFriends}
                disabled={running}
              />
            )}
          />
        </Card.Content>
      </Card>
      <Card mode="elevated">
        <Card.Content style={styles.gap}>
          <Text variant="titleMedium">{t("splitwiseImport.pasteTitle")}</Text>
          <TextInput
            mode="outlined"
            label={t("splitwiseImport.apiKeyLabel")}
            value={apiKey}
            onChangeText={setApiKey}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            disabled={running}
          />
          <Button
            mode="contained"
            icon="cloud-download-outline"
            onPress={handleImport}
            disabled={!apiKey.trim() || running}
            loading={running}
          >
            {t("splitwiseImport.startImport")}
          </Button>
          {running ? (
            <HelperText type="info">{t("splitwiseImport.running")}</HelperText>
          ) : null}
        </Card.Content>
      </Card>
      {summary ? (
        <Card mode="elevated">
          <Card.Content style={styles.gap}>
            <Text variant="titleMedium">
              {t("splitwiseImport.successTitle")}
            </Text>
            <Text>
              {t("splitwiseImport.summaryGroups", {
                count: summary.groups_created,
              })}
            </Text>
            <Text>
              {t("splitwiseImport.summaryExpenses", {
                count: summary.expenses_imported,
              })}
            </Text>
            <Text>
              {t("splitwiseImport.summarySettlements", {
                count: summary.settlements_imported,
              })}
            </Text>
            {summary.skipped_expenses > 0 ? (
              <Text>
                {t("splitwiseImport.summarySkipped", {
                  count: summary.skipped_expenses,
                })}
              </Text>
            ) : null}
          </Card.Content>
        </Card>
      ) : null}
    </Screen>
  );
}

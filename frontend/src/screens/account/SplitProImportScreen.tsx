import { useState } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  HelperText,
  List,
  RadioButton,
  Snackbar,
  Switch,
  Text,
  TextInput,
  useTheme
} from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { ApiError } from "../../shared/api/client";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

type ImportSummary = {
  groups_created: number;
  expenses_imported: number;
  settlements_imported: number;
  skipped_expenses: number;
};

type ImportResponse = { summary: ImportSummary };

type SplitProUser = { id: number; name: string; email: string };

type UsersResponse = { users: SplitProUser[] };

const STEP_KEYS = [
  "splitProImport.step1",
  "splitProImport.step2",
  "splitProImport.step3",
  "splitProImport.step4"
];

function extractApiDetail(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const detail = error.data?.detail;
    if (typeof detail === "string" && detail.length > 0) return detail;
    return fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function SplitProImportScreen() {
  const { t } = useI18n();
  const { api, user: splexUser } = useAuth();
  const theme = useTheme();
  const [host, setHost] = useState("");
  const [port, setPort] = useState("5432");
  const [dbname, setDbname] = useState("");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [importFriends, setImportFriends] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [users, setUsers] = useState<SplitProUser[] | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const portNumber = Number(port);
  const portValid = Number.isInteger(portNumber) && portNumber > 0 && portNumber <= 65535;
  const credentialsValid =
    host.trim().length > 0 &&
    dbname.trim().length > 0 &&
    user.trim().length > 0 &&
    password.length > 0 &&
    portValid;
  const credentialsLocked = users !== null;
  const canConnect = !connecting && !running && credentialsValid && !credentialsLocked;
  const canImport = !running && credentialsLocked && selectedUserId !== null;

  function buildCredentials() {
    return {
      host: host.trim(),
      port: portNumber,
      dbname: dbname.trim(),
      user: user.trim(),
      password
    };
  }

  function resetConnection() {
    setUsers(null);
    setSelectedUserId(null);
    setSummary(null);
  }

  async function handleConnect() {
    if (!canConnect) return;
    setConnecting(true);
    setSummary(null);
    try {
      const result = await api.post<UsersResponse>(
        "/api/imports/split-pro/users/",
        buildCredentials()
      );
      const fetched = result.users ?? [];
      setUsers(fetched);
      // Best-effort pre-selection by email - users still have to confirm.
      const splexEmail = splexUser?.email?.toLowerCase();
      const match = splexEmail
        ? fetched.find((row) => row.email && row.email.toLowerCase() === splexEmail)
        : undefined;
      setSelectedUserId(match?.id ?? fetched[0]?.id ?? null);
    } catch (error) {
      setErrorMessage(extractApiDetail(error, t("splitProImport.connectionFailed")));
    } finally {
      setConnecting(false);
    }
  }

  async function handleImport() {
    if (!canImport || selectedUserId === null) return;
    setRunning(true);
    setSummary(null);
    try {
      const result = await api.post<ImportResponse>("/api/imports/split-pro/", {
        ...buildCredentials(),
        actor_user_id: selectedUserId,
        import_friends_as_groups: importFriends
      });
      setSummary(result.summary);
      setPassword("");
    } catch (error) {
      setErrorMessage(extractApiDetail(error, t("common.error")));
    } finally {
      setRunning(false);
    }
  }

  function describeUser(row: SplitProUser): string {
    const name = row.name.trim();
    if (name && row.email) return `${name} (${row.email})`;
    if (name) return name;
    if (row.email) return row.email;
    return t("splitProImport.unnamedUser", { id: row.id });
  }

  return (
    <Screen>
      <Text variant="headlineSmall">{t("splitProImport.title")}</Text>
      <Card mode="elevated">
        <Card.Content style={styles.gap}>
          <Text variant="titleMedium">{t("splitProImport.howToTitle")}</Text>
          <Text variant="bodyMedium">{t("splitProImport.intro")}</Text>
          <View style={{ gap: 12, marginTop: 4 }}>
            {STEP_KEYS.map((key, index) => (
              <View
                key={key}
                style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}
              >
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.colors.primaryContainer,
                    borderRadius: 14,
                    height: 28,
                    justifyContent: "center",
                    width: 28
                  }}
                >
                  <Text
                    variant="labelLarge"
                    style={{ color: theme.colors.onPrimaryContainer, fontWeight: "700" }}
                  >
                    {index + 1}
                  </Text>
                </View>
                <Text variant="bodyMedium" style={{ flex: 1, lineHeight: 22 }}>
                  {t(key)}
                </Text>
              </View>
            ))}
          </View>
          <HelperText type="info" style={{ marginTop: 4 }}>
            {t("splitProImport.privacyNote")}
          </HelperText>
          <HelperText type="info">{t("splitProImport.compatibilityNote")}</HelperText>
        </Card.Content>
      </Card>
      <Card mode="elevated">
        <Card.Content style={styles.gap}>
          <Text variant="titleMedium">{t("splitProImport.friendsAsGroups.title")}</Text>
          <Text variant="bodyMedium">
            {t("splitProImport.friendsAsGroups.explanation")}
          </Text>
          <List.Item
            title={t("splitProImport.friendsAsGroups.toggleTitle")}
            description={t("splitProImport.friendsAsGroups.toggleDescription")}
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
          <Text variant="titleMedium">{t("splitProImport.connectionTitle")}</Text>
          <TextInput
            mode="outlined"
            label={t("splitProImport.host")}
            value={host}
            onChangeText={setHost}
            autoCapitalize="none"
            autoCorrect={false}
            disabled={connecting || running || credentialsLocked}
            placeholder="db.example.com"
          />
          <TextInput
            mode="outlined"
            label={t("splitProImport.port")}
            value={port}
            onChangeText={setPort}
            keyboardType="number-pad"
            disabled={connecting || running || credentialsLocked}
          />
          <TextInput
            mode="outlined"
            label={t("splitProImport.dbname")}
            value={dbname}
            onChangeText={setDbname}
            autoCapitalize="none"
            autoCorrect={false}
            disabled={connecting || running || credentialsLocked}
          />
          <TextInput
            mode="outlined"
            label={t("splitProImport.user")}
            value={user}
            onChangeText={setUser}
            autoCapitalize="none"
            autoCorrect={false}
            disabled={connecting || running || credentialsLocked}
          />
          <TextInput
            mode="outlined"
            label={t("splitProImport.password")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            disabled={connecting || running || credentialsLocked}
          />
          {!credentialsLocked ? (
            <Button
              mode="contained"
              icon="lan-connect"
              onPress={handleConnect}
              disabled={!canConnect}
              loading={connecting}
            >
              {t("splitProImport.connect")}
            </Button>
          ) : (
            <Button mode="text" icon="pencil-outline" onPress={resetConnection} disabled={running}>
              {t("splitProImport.changeCredentials")}
            </Button>
          )}
          {connecting ? (
            <HelperText type="info">{t("splitProImport.connecting")}</HelperText>
          ) : null}
        </Card.Content>
      </Card>
      {users !== null ? (
        <Card mode="elevated">
          <Card.Content style={styles.gap}>
            <Text variant="titleMedium">{t("splitProImport.pickUserTitle")}</Text>
            <Text variant="bodyMedium">{t("splitProImport.pickUserDescription")}</Text>
            {users.length === 0 ? (
              <HelperText type="error">{t("splitProImport.noUsers")}</HelperText>
            ) : (
              <RadioButton.Group
                value={selectedUserId !== null ? String(selectedUserId) : ""}
                onValueChange={(value) => setSelectedUserId(Number(value))}
              >
                {users.map((row) => (
                  <RadioButton.Item
                    key={row.id}
                    label={describeUser(row)}
                    value={String(row.id)}
                    disabled={running}
                  />
                ))}
              </RadioButton.Group>
            )}
            <Button
              mode="contained"
              icon="database-arrow-down-outline"
              onPress={handleImport}
              disabled={!canImport}
              loading={running}
            >
              {t("splitProImport.startImport")}
            </Button>
            {running ? (
              <HelperText type="info">{t("splitProImport.running")}</HelperText>
            ) : null}
          </Card.Content>
        </Card>
      ) : null}
      {summary ? (
        <Card mode="elevated">
          <Card.Content style={styles.gap}>
            <Text variant="titleMedium">{t("splitProImport.successTitle")}</Text>
            <Text>{t("splitProImport.summaryGroups", { count: summary.groups_created })}</Text>
            <Text>{t("splitProImport.summaryExpenses", { count: summary.expenses_imported })}</Text>
            <Text>
              {t("splitProImport.summarySettlements", { count: summary.settlements_imported })}
            </Text>
            {summary.skipped_expenses > 0 ? (
              <Text>
                {t("splitProImport.summarySkipped", { count: summary.skipped_expenses })}
              </Text>
            ) : null}
          </Card.Content>
        </Card>
      ) : null}
      <Snackbar
        visible={!!errorMessage}
        onDismiss={() => setErrorMessage("")}
        duration={6000}
        action={{ label: t("common.dismiss"), onPress: () => setErrorMessage("") }}
      >
        {errorMessage}
      </Snackbar>
    </Screen>
  );
}

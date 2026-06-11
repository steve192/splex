import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Card, List, Text } from "react-native-paper";

import { AccountStackParamList } from "../../application/navigationTypes";
import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

type ServerConfig = { risky_imports_enabled?: boolean };

export function ImportFromServiceScreen() {
  const { t } = useI18n();
  const { api } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AccountStackParamList>>();
  const [riskyImportsEnabled, setRiskyImportsEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ServerConfig>("/api/login/config/")
      .then((data) => {
        if (!cancelled) setRiskyImportsEnabled(Boolean(data.risky_imports_enabled));
      })
      .catch(() => {
        if (!cancelled) setRiskyImportsEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const splitProDisabled = riskyImportsEnabled === false;
  const splitProDescription = splitProDisabled
    ? t("importFromService.splitPro.disabledByServer")
    : t("importFromService.splitPro.description");

  return (
    <Screen>
      <Text variant="bodyMedium">{t("importFromService.intro")}</Text>
      <Card mode="elevated">
        <Card.Content style={styles.gap}>
          <List.Item
            title={t("importFromService.splitwise.title")}
            description={t("importFromService.splitwise.description")}
            left={(props) => <List.Icon {...props} icon="swap-horizontal" />}
            onPress={() => navigation.navigate("SplitwiseImport")}
          />
          <List.Item
            title={t("importFromService.splitPro.title")}
            description={splitProDescription}
            disabled={splitProDisabled}
            style={splitProDisabled ? { opacity: 0.5 } : undefined}
            left={(props) => <List.Icon {...props} icon="database-arrow-down-outline" />}
            onPress={
              splitProDisabled ? undefined : () => navigation.navigate("SplitProImport")
            }
          />
        </Card.Content>
      </Card>
    </Screen>
  );
}

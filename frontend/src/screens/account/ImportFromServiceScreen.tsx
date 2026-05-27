import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Card, List, Text } from "react-native-paper";

import { AccountStackParamList } from "../../application/navigationTypes";
import { useI18n } from "../../shared/i18n/I18nContext";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

export function ImportFromServiceScreen() {
  const { t } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<AccountStackParamList>>();

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
            description={t("importFromService.splitPro.description")}
            left={(props) => <List.Icon {...props} icon="database-arrow-down-outline" />}
            onPress={() => navigation.navigate("SplitProImport")}
          />
        </Card.Content>
      </Card>
    </Screen>
  );
}

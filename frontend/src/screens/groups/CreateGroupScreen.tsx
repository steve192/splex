import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Button, Card, Text, TextInput } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { OverviewStackParamList } from "../../application/navigationTypes";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { CURRENCIES } from "../../shared/lib/currencies";
import { Group } from "../../shared/types/models";
import { Screen } from "../../shared/ui/Screen";
import { SelectionOption, SelectionSheet } from "../../shared/ui/SelectionSheet";
import { styles } from "../../shared/ui/styles";

type CreateGroupScreenProps = NativeStackScreenProps<OverviewStackParamList, "CreateGroup">;

export function CreateGroupScreen({ navigation }: Readonly<CreateGroupScreenProps>) {
  const { t } = useI18n();
  const { api } = useAuth();
  const { showSuccess } = useFeedback();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const currencyOptions: SelectionOption<string>[] = CURRENCIES.map((code) => ({ value: code, label: code }));

  async function save() {
    setSaving(true);
    try {
      const group = await api.post<Group>("/api/groups/", {
        name,
        default_currency: currency.toUpperCase()
      });
      showSuccess({ icon: "check" });
      navigation.replace("GroupDetail", { id: group.id });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Text variant="headlineSmall">{t("group.create")}</Text>
      <Card mode="elevated">
        <Card.Content style={styles.gap}>
          <TextInput mode="outlined" label={t("group.name")} value={name} onChangeText={setName} />
          <Button mode="elevated" onPress={() => setCurrencySheetOpen(true)}>
            {t("expense.currency")}: {currency}
          </Button>
          <Button mode="contained" loading={saving} disabled={!name || currency.length !== 3} onPress={save}>
            {t("common.save")}
          </Button>
        </Card.Content>
      </Card>
      <SelectionSheet
        visible={currencySheetOpen}
        title={t("expense.currency")}
        options={currencyOptions}
        value={currency}
        onSelect={setCurrency}
        onDismiss={() => setCurrencySheetOpen(false)}
      />
    </Screen>
  );
}

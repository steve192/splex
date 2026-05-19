import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Dialog, List, Text, TextInput } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import { CURRENCIES } from "../lib/currencies";
import { PersonAvatar } from "../ui/PersonAvatar";
import { SelectionOption, SelectionSheet } from "../ui/SelectionSheet";
import { styles } from "../ui/styles";

export type SettlementDialogTarget = {
  payer_participant_id: number;
  payer_display_name: string;
  payer_avatar_url?: string;
  receiver_participant_id: number;
  receiver_display_name: string;
  receiver_avatar_url?: string;
  amount: string;
  currency: string;
};

type SettlementDialogProps = {
  visible: boolean;
  target: SettlementDialogTarget | null;
  amount: string;
  currency: string;
  onAmountChange: (amount: string) => void;
  onCurrencyChange: (currency: string) => void;
  onDismiss: () => void;
  onSave: () => void;
};

export function SettlementDialog({
  visible,
  target,
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
  onDismiss,
  onSave
}: SettlementDialogProps) {
  const { t } = useI18n();
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const currencyOptions: SelectionOption<string>[] = CURRENCIES.map((code) => ({ value: code, label: code }));

  useEffect(() => {
    if (!visible) setCurrencySheetOpen(false);
  }, [visible]);

  return (
    <>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{t("settlement.title")}</Dialog.Title>
        <Dialog.Content>
          {target ? (
            <View style={styles.settlementPreview}>
              <View style={styles.settlementPerson}>
                <PersonAvatar name={target.payer_display_name} imageUrl={target.payer_avatar_url} />
                <Text variant="bodyMedium">{target.payer_display_name}</Text>
              </View>
              <List.Icon icon="arrow-right" />
              <View style={styles.settlementPerson}>
                <PersonAvatar name={target.receiver_display_name} imageUrl={target.receiver_avatar_url} />
                <Text variant="bodyMedium">{target.receiver_display_name}</Text>
              </View>
            </View>
          ) : null}
          <View style={styles.formRow}>
            <TextInput
              mode="outlined"
              label={t("expense.amount")}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={onAmountChange}
              style={styles.flex}
            />
            <Button mode="elevated" onPress={() => setCurrencySheetOpen(true)} style={styles.selfCenter}>
              {currency}
            </Button>
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t("common.cancel")}</Button>
          <Button disabled={!amount || !target} onPress={onSave}>
            {t("settlement.save")}
          </Button>
        </Dialog.Actions>
      </Dialog>
      <SelectionSheet
        visible={visible && currencySheetOpen}
        title={t("expense.currency")}
        options={currencyOptions}
        value={currency}
        onSelect={onCurrencyChange}
        onDismiss={() => setCurrencySheetOpen(false)}
      />
    </>
  );
}

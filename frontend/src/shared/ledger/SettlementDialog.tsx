import { View } from "react-native";
import { Button, Dialog, List, Text, TextInput } from "react-native-paper";

import { PersonAvatar } from "../ui/PersonAvatar";
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
  t: (key: string) => string;
  onAmountChange: (amount: string) => void;
  onDismiss: () => void;
  onSave: () => void;
};

export function SettlementDialog({
  visible,
  target,
  amount,
  t,
  onAmountChange,
  onDismiss,
  onSave
}: SettlementDialogProps) {
  return (
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
        <TextInput
          mode="outlined"
          label={t("expense.amount")}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={onAmountChange}
        />
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss}>{t("common.cancel")}</Button>
        <Button disabled={!amount || !target} onPress={onSave}>
          {t("settlement.save")}
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}

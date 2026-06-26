import { View } from "react-native";
import { List, Modal, Portal, Switch, Text, Button, useTheme } from "react-native-paper";

import { useI18n } from "../../shared/i18n/I18nContext";
import { useKeyboardHeight } from "../../shared/lib/useKeyboardHeight";
import { asNumber } from "../../shared/lib/money";
import { Participant } from "../../shared/types/models";
import { negativeColor } from "../../shared/ui/colors";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { MoneyAmountInput } from "../../shared/ui/MoneyAmountInput";
import { styles } from "../../shared/ui/styles";
import { currencyAmount } from "./expenseFormLogic";

type PayerSheetProps = {
  visible: boolean;
  participants: Participant[];
  currentParticipantId: number | null;
  multiPayer: boolean;
  payerId: number | null;
  paymentValues: Record<number, string>;
  paymentLeft: number;
  paymentConfigInvalid: boolean;
  totalAmount: number;
  currency: string;
  onDismiss: () => void;
  onMultiPayerChange: (value: boolean) => void;
  onPayerChange: (participantId: number) => void;
  onPaymentValueChange: (participantId: number, value: string) => void;
};

export function PayerSheet({
  visible,
  participants,
  currentParticipantId,
  multiPayer,
  payerId,
  paymentValues,
  paymentLeft,
  paymentConfigInvalid,
  totalAmount,
  currency,
  onDismiss,
  onMultiPayerChange,
  onPayerChange,
  onPaymentValueChange
}: Readonly<PayerSheetProps>) {
  const { t } = useI18n();
  const theme = useTheme();
  const errorStyle = { color: negativeColor(theme) };
  const keyboardHeight = useKeyboardHeight();

  function nameFor(participant: Participant) {
    return participant.id === currentParticipantId ? t("common.you") : participant.display_name;
  }

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.bottomSheet, { backgroundColor: theme.colors.surface }]}
        style={[styles.bottomSheetWrapper, { marginBottom: keyboardHeight }]}
      >
        <View style={[styles.bottomSheetHandle, { backgroundColor: theme.colors.outlineVariant }]} />
        <View style={styles.rowBetween}>
          <Text variant="titleLarge">{t("expense.paidBy")}</Text>
          <Button disabled={paymentConfigInvalid} onPress={onDismiss}>
            {t("common.done")}
          </Button>
        </View>
        <View style={styles.rowBetween}>
          <Text variant="bodyMedium">{t("expense.multiplePayers")}</Text>
          <Switch value={multiPayer} onValueChange={onMultiPayerChange} />
        </View>
        {multiPayer ? (
          <View style={styles.gap}>
            <Text variant="bodyMedium" style={paymentConfigInvalid ? errorStyle : undefined}>
              {t("expense.amountLeft", { amount: currencyAmount(paymentLeft, currency) })}
            </Text>
            {participants.map((participant) => (
              <List.Item
                key={participant.id}
                style={styles.listTile}
                title={nameFor(participant)}
                description={t("expense.memberPays", {
                  amount: currencyAmount(asNumber(paymentValues[participant.id]), currency)
                })}
                left={() => <PersonAvatar name={nameFor(participant)} imageUrl={participant.avatar_url} />}
                right={() => (
                  <MoneyAmountInput
                    mode="outlined"
                    dense
                    style={styles.splitRowInput}
                    value={paymentValues[participant.id] ?? ""}
                    onChangeText={(value) => onPaymentValueChange(participant.id, value)}
                  />
                )}
              />
            ))}
          </View>
        ) : (
          participants.map((participant) => (
            <List.Item
              key={participant.id}
              style={styles.listTile}
              title={nameFor(participant)}
              description={currencyAmount(totalAmount, currency)}
              onPress={() => onPayerChange(participant.id)}
              left={() => <PersonAvatar name={nameFor(participant)} imageUrl={participant.avatar_url} />}
              right={(props) => (
                <List.Icon {...props} icon={payerId === participant.id ? "radiobox-marked" : "radiobox-blank"} />
              )}
            />
          ))
        )}
      </Modal>
    </Portal>
  );
}

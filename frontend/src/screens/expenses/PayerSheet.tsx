import { View } from "react-native";
import { List, Modal, Portal, Switch, Text, TextInput, Button, useTheme } from "react-native-paper";

import { Participant } from "../../shared/types/models";
import { negativeColor } from "../../shared/ui/colors";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { styles } from "../../shared/ui/styles";

type PayerSheetProps = {
  visible: boolean;
  participants: Participant[];
  multiPayer: boolean;
  payerId: number | null;
  paymentValues: Record<number, string>;
  paymentLeft: number;
  paymentConfigInvalid: boolean;
  totalAmount: number;
  currency: string;
  surfaceColor: string;
  handleColor: string;
  t: (key: string) => string;
  participantName: (participant: Participant) => string;
  currencyAmount: (value: number, currency: string) => string;
  asNumber: (value: string | number | undefined) => number;
  onDismiss: () => void;
  onMultiPayerChange: (value: boolean) => void;
  onPayerChange: (participantId: number) => void;
  onPaymentValueChange: (participantId: number, value: string) => void;
};

export function PayerSheet({
  visible,
  participants,
  multiPayer,
  payerId,
  paymentValues,
  paymentLeft,
  paymentConfigInvalid,
  totalAmount,
  currency,
  surfaceColor,
  handleColor,
  t,
  participantName,
  currencyAmount,
  asNumber,
  onDismiss,
  onMultiPayerChange,
  onPayerChange,
  onPaymentValueChange
}: PayerSheetProps) {
  const theme = useTheme();
  const errorStyle = { color: negativeColor(theme) };
  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.bottomSheet, { backgroundColor: surfaceColor }]}
        style={styles.bottomSheetWrapper}
      >
        <View style={[styles.bottomSheetHandle, { backgroundColor: handleColor }]} />
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
        {!multiPayer ? (
          participants.map((participant) => (
            <List.Item
              key={participant.id}
              style={styles.listTile}
              title={participantName(participant)}
              description={currencyAmount(totalAmount, currency)}
              onPress={() => onPayerChange(participant.id)}
              left={() => <PersonAvatar name={participantName(participant)} imageUrl={participant.avatar_url} />}
              right={(props) => (
                <List.Icon {...props} icon={payerId === participant.id ? "radiobox-marked" : "radiobox-blank"} />
              )}
            />
          ))
        ) : (
          <View style={styles.gap}>
            <Text variant="bodyMedium" style={paymentConfigInvalid ? errorStyle : undefined}>
              {t("expense.amountLeft").replace("{amount}", currencyAmount(paymentLeft, currency))}
            </Text>
            {participants.map((participant) => (
              <List.Item
                key={participant.id}
                style={styles.listTile}
                title={participantName(participant)}
                description={t("expense.memberPays").replace(
                  "{amount}",
                  currencyAmount(asNumber(paymentValues[participant.id]), currency)
                )}
                left={() => <PersonAvatar name={participantName(participant)} imageUrl={participant.avatar_url} />}
                right={() => (
                  <TextInput
                    mode="outlined"
                    dense
                    style={styles.splitRowInput}
                    keyboardType="decimal-pad"
                    value={paymentValues[participant.id] ?? ""}
                    onChangeText={(value) => onPaymentValueChange(participant.id, value)}
                  />
                )}
              />
            ))}
          </View>
        )}
      </Modal>
    </Portal>
  );
}

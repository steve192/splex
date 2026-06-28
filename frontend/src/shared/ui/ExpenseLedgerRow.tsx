import { View } from "react-native";
import { Card, Text, TouchableRipple } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import { formatDeviceDateParts } from "../lib/dates";
import { asNumber } from "../lib/money";
import { Expense } from "../types/models";
import { AvatarStack } from "./AvatarStack";
import { BalanceStack } from "./BalanceStack";
import { payerLine } from "./expenseLedgerRowModel";
import { styles } from "./styles";

type ExpenseLedgerRowProps = {
  expense: Expense;
  currentParticipantId?: number | null;
  onPress: () => void;
};

export function ExpenseLedgerRow({ expense, currentParticipantId, onPress }: Readonly<ExpenseLedgerRowProps>) {
  const { t } = useI18n();
  const parts = formatDeviceDateParts(expense.date);
  const paid = expense.payments
    .filter((share) => share.participant_id === currentParticipantId)
    .reduce((sum, share) => sum + asNumber(share.amount), 0);
  const owed = expense.owed
    .filter((share) => share.participant_id === currentParticipantId)
    .reduce((sum, share) => sum + asNumber(share.amount), 0);
  const net = paid - owed;

  return (
    <Card mode="elevated" style={styles.card}>
      <TouchableRipple style={styles.clickable} onPress={onPress}>
        <Card.Content style={styles.expenseRow}>
          <View style={styles.expenseDate}>
            <Text variant="labelSmall">{parts.month}</Text>
            <Text variant="titleMedium">{parts.day}</Text>
          </View>
          <AvatarStack people={expense.payments} />
          <View style={styles.flex}>
            <Text variant="titleMedium">{expense.description}</Text>
            <Text variant="bodySmall">{payerLine(expense, t)}</Text>
          </View>
          <View style={styles.expenseNet}>
            <BalanceStack amount={net} currency={expense.converted_currency} />
          </View>
        </Card.Content>
      </TouchableRipple>
    </Card>
  );
}

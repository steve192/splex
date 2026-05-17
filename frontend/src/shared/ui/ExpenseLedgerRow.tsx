import { View } from "react-native";
import { Card, Text, TouchableRipple, useTheme } from "react-native-paper";

import { asNumber, formatMoney } from "../lib/money";
import { Expense } from "../types/models";
import { AvatarStack } from "./AvatarStack";
import { styles } from "./styles";

type ExpenseLedgerRowProps = {
  expense: Expense;
  currentParticipantId?: number | null;
  t: (key: string) => string;
  onPress: () => void;
};

function dateParts(value: string) {
  const date = value ? new Date(value) : new Date();
  return {
    month: date.toLocaleString(undefined, { month: "short" }).toUpperCase(),
    day: String(date.getDate()).padStart(2, "0")
  };
}

function payerLine(expense: Expense, t: (key: string) => string): string {
  if (!expense.payments.length) return "";
  const names = expense.payments.map((share) => share.display_name).filter(Boolean);
  const payerNames =
    names.length <= 2
      ? names.join(", ")
      : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  return t("expense.payerLine")
    .replace("{payer}", payerNames)
    .replace("{amount}", `${formatMoney(expense.converted_amount)} ${expense.converted_currency}`);
}

export function ExpenseLedgerRow({ expense, currentParticipantId, t, onPress }: ExpenseLedgerRowProps) {
  const theme = useTheme();
  const parts = dateParts(expense.date);
  const paid = expense.payments
    .filter((share) => share.participant_id === currentParticipantId)
    .reduce((sum, share) => sum + asNumber(share.amount), 0);
  const owed = expense.owed
    .filter((share) => share.participant_id === currentParticipantId)
    .reduce((sum, share) => sum + asNumber(share.amount), 0);
  const net = paid - owed;
  const color =
    net > 0
      ? (theme.dark ? "#7DDC9F" : "#0F7B3A")
      : net < 0
        ? (theme.dark ? "#FFB4AB" : "#B3261E")
        : theme.colors.onSurfaceVariant;
  const label = net > 0 ? t("balance.owedToYou") : net < 0 ? t("balance.youOwe") : t("balance.settled");

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
            <Text variant="bodySmall" style={{ color }}>{label}</Text>
            <Text variant="titleSmall" style={{ color, fontWeight: "700" }}>
              {net === 0 ? "" : `${formatMoney(net)} ${expense.converted_currency}`}
            </Text>
          </View>
        </Card.Content>
      </TouchableRipple>
    </Card>
  );
}

import { StyleSheet, View } from "react-native";
import { Card, List, Text, TouchableRipple } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import { formatDeviceDateParts } from "../lib/dates";
import { Settlement } from "../types/models";
import { MoneyText } from "../ui/MoneyText";
import { PersonAvatar } from "../ui/PersonAvatar";
import { styles } from "../ui/styles";

type SettlementLedgerRowProps = {
  settlement: Settlement;
  onPress: () => void;
};

export function SettlementLedgerRow({ settlement, onPress }: SettlementLedgerRowProps) {
  const { t } = useI18n();
  const parts = formatDeviceDateParts(settlement.created_at);
  const isWriteOff = settlement.kind === "auto_write_off";
  const title = isWriteOff ? t("settlement.autoWriteOffTitle") : t("settlement.title");
  const description = isWriteOff
    ? t("settlement.autoWriteOffLine", { name: settlement.payer_display_name ?? "" })
    : t("settlement.line", {
        from: settlement.payer_display_name ?? "",
        to: settlement.receiver_display_name ?? "",
        amount: `${settlement.amount} ${settlement.currency}`
      });
  // Write-offs are bookkeeping entries, not real payments. Render with a distinct
  // icon and skip the payer→receiver avatar pair so users don't read it as
  // "Bob actually paid Alice".
  return (
    <Card mode="elevated" style={styles.card}>
      <TouchableRipple style={styles.clickable} onPress={onPress}>
        <Card.Content style={[styles.expenseRow, settlementRowStyles.row]}>
          <View style={styles.expenseDate}>
            <Text variant="labelSmall">{parts.month}</Text>
            <Text variant="titleMedium">{parts.day}</Text>
          </View>
          <View style={styles.flex}>
            {isWriteOff ? (
              <View style={settlementRowStyles.avatars}>
                <List.Icon icon="account-off-outline" />
              </View>
            ) : (
              <View style={settlementRowStyles.avatars}>
                <PersonAvatar
                  name={settlement.payer_display_name}
                  imageUrl={settlement.payer_avatar_url}
                  size={36}
                />
                <List.Icon icon="arrow-right" />
                <PersonAvatar
                  name={settlement.receiver_display_name}
                  imageUrl={settlement.receiver_avatar_url}
                  size={36}
                />
              </View>
            )}
            <Text variant="titleMedium">{title}</Text>
            <Text variant="bodySmall">{description}</Text>
          </View>
          <View style={settlementRowStyles.amount}>
            <MoneyText plain amount={settlement.amount} currency={settlement.currency} />
          </View>
        </Card.Content>
      </TouchableRipple>
    </Card>
  );
}

const SETTLEMENT_ROW_MIN_HEIGHT = 112;

const settlementRowStyles = StyleSheet.create({
  amount: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 96
  },
  avatars: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginBottom: 6
  },
  row: {
    minHeight: SETTLEMENT_ROW_MIN_HEIGHT,
    paddingVertical: 12
  }
});

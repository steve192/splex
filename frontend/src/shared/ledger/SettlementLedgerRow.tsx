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
  return (
    <Card mode="elevated" style={styles.card}>
      <TouchableRipple style={styles.clickable} onPress={onPress}>
        <Card.Content style={[styles.expenseRow, settlementRowStyles.row]}>
          <View style={styles.expenseDate}>
            <Text variant="labelSmall">{parts.month}</Text>
            <Text variant="titleMedium">{parts.day}</Text>
          </View>
          <View style={styles.flex}>
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
            <Text variant="titleMedium">{t("settlement.title")}</Text>
            <Text variant="bodySmall">
              {t("settlement.line", {
                from: settlement.payer_display_name ?? "",
                to: settlement.receiver_display_name ?? "",
                amount: `${settlement.amount} ${settlement.currency}`
              })}
            </Text>
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

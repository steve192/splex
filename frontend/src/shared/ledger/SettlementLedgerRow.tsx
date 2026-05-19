import { View } from "react-native";
import { Card, List, Text, TouchableRipple } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
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
  return (
    <Card mode="elevated" style={styles.card}>
      <TouchableRipple style={styles.clickable} onPress={onPress}>
        <Card.Content style={styles.expenseRow}>
          <PersonAvatar name={settlement.payer_display_name} imageUrl={settlement.payer_avatar_url} />
          <List.Icon icon="arrow-right" />
          <PersonAvatar name={settlement.receiver_display_name} imageUrl={settlement.receiver_avatar_url} />
          <View style={styles.flex}>
            <Text variant="titleMedium">{t("settlement.title")}</Text>
            <Text variant="bodySmall">
              {t("settlement.line", {
                from: settlement.payer_display_name ?? "",
                to: settlement.receiver_display_name ?? "",
                amount: `${settlement.amount} ${settlement.currency}`
              })}
            </Text>
          </View>
          <View style={styles.listTileRight}>
            <MoneyText amount={settlement.amount} currency={settlement.currency} />
          </View>
        </Card.Content>
      </TouchableRipple>
    </Card>
  );
}

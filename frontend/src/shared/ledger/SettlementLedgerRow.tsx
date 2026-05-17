import { View } from "react-native";
import { Card, List, Text, TouchableRipple } from "react-native-paper";

import { Settlement } from "../types/models";
import { MoneyText } from "../ui/MoneyText";
import { PersonAvatar } from "../ui/PersonAvatar";
import { styles } from "../ui/styles";

type SettlementLedgerRowProps = {
  settlement: Settlement;
  t: (key: string) => string;
  onPress: () => void;
};

export function SettlementLedgerRow({ settlement, t, onPress }: SettlementLedgerRowProps) {
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
              {t("settlement.line")
                .replace("{from}", settlement.payer_display_name ?? "")
                .replace("{to}", settlement.receiver_display_name ?? "")
                .replace("{amount}", `${settlement.amount} ${settlement.currency}`)}
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

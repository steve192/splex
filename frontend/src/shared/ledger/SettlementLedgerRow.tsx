import { View } from "react-native";
import { Card, List, TouchableRipple } from "react-native-paper";

import { Settlement } from "../types/models";
import { MoneyText } from "../ui/MoneyText";
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
        <Card.Content>
          <List.Item
            style={styles.listTile}
            title={t("settlement.title")}
            description={t("settlement.line")
              .replace("{from}", settlement.payer_display_name ?? "")
              .replace("{to}", settlement.receiver_display_name ?? "")
              .replace("{amount}", `${settlement.amount} ${settlement.currency}`)}
            right={() => (
              <View style={styles.listTileRight}>
                <MoneyText amount={settlement.amount} currency={settlement.currency} />
              </View>
            )}
          />
        </Card.Content>
      </TouchableRipple>
    </Card>
  );
}

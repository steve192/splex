import { View } from "react-native";
import { Button, Card, List, Text, TouchableRipple, useTheme } from "react-native-paper";

import { PendingMutation } from "../sync/queue";
import { negativeColor } from "../ui/colors";
import { styles } from "../ui/styles";

type PendingExpenseListProps = {
  mutations: PendingMutation[];
  fallbackCurrency?: string;
  t: (key: string) => string;
  onOpen: (mutationId: string) => void;
  onRetry: () => void;
  onDelete: (mutationId: string) => void;
};

export function PendingExpenseList({
  mutations,
  fallbackCurrency,
  t,
  onOpen,
  onRetry,
  onDelete
}: PendingExpenseListProps) {
  const theme = useTheme();
  const dangerColor = negativeColor(theme);
  return (
    <>
      {mutations.map((mutation) => {
        const payload = mutation.payload as { expense?: { description?: string; amount?: string; currency?: string } };
        const expense = payload?.expense ?? {};
        return (
          <Card key={`pending-${mutation.id}`} mode="elevated" style={styles.card}>
            <TouchableRipple style={styles.clickable} onPress={() => onOpen(mutation.id)}>
              <Card.Content>
                <List.Item
                  style={styles.listTile}
                  title={expense.description || t("expense.add")}
                  description={`${t("expense.pendingSync")} - ${mutation.lastError ?? mutation.status}`}
                  right={() => (
                    <View style={styles.listTileRight}>
                      <Text>{`${expense.amount ?? ""} ${expense.currency ?? fallbackCurrency ?? ""}`}</Text>
                      <View style={styles.rowActions}>
                        <Button compact mode="text" onPress={onRetry}>
                          {t("expense.retrySync")}
                        </Button>
                        <Button compact mode="text" textColor={dangerColor} onPress={() => onDelete(mutation.id)}>
                          {t("common.delete")}
                        </Button>
                      </View>
                    </View>
                  )}
                />
              </Card.Content>
            </TouchableRipple>
          </Card>
        );
      })}
    </>
  );
}

import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Card, Dialog, Divider, List, Portal, Text } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { Expense } from "../../shared/types/models";
import { MoneyText } from "../../shared/ui/MoneyText";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

export function ExpenseDetailScreen({ route, navigation }: any) {
  const { t } = useI18n();
  const { api } = useAuth();
  const expenseId = route.params.id;
  const [expense, setExpense] = useState<Expense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function load() {
    setExpense(await api.get<Expense>(`/api/expenses/${expenseId}/`));
  }

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => load().catch(() => undefined));
    return unsubscribe;
  }, [navigation, expenseId]);

  async function deleteExpense() {
    await api.delete(`/api/expenses/${expenseId}/`);
    setConfirmDelete(false);
    navigation.goBack();
  }

  function editExpense() {
    if (!expense) return;
    navigation.navigate("AddExpense", {
      expenseId: expense.id,
      contextType: expense.group_id ? "group" : "friendship",
      contextId: expense.group_id ?? expense.friendship_id,
      resetKey: Date.now(),
      returnToPrevious: true
    });
  }

  return (
    <View style={styles.flex}>
      <Screen>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text variant="headlineSmall">{expense?.description ?? t("expense.details")}</Text>
            {expense ? <Text variant="bodyMedium">{expense.date}</Text> : null}
          </View>
          <Button mode="elevated" icon="pencil" disabled={!expense || Boolean(expense?.deleted_at)} onPress={editExpense}>
            {t("common.edit")}
          </Button>
        </View>

        {expense ? (
          <>
            <View style={styles.metricGrid}>
              <Card mode="elevated" style={styles.metricTile}>
                <Card.Content>
                  <Text variant="labelLarge">{t("expense.amount")}</Text>
                  <MoneyText
                    variant="headlineSmall"
                    amount={expense.converted_amount}
                    currency={expense.converted_currency}
                  />
                </Card.Content>
              </Card>
              <Card mode="elevated" style={styles.metricTile}>
                <Card.Content>
                  <Text variant="labelLarge">{t("expense.originalAmount")}</Text>
                  <Text variant="headlineSmall">
                    {expense.original_amount} {expense.original_currency}
                  </Text>
                </Card.Content>
              </Card>
            </View>

            <Card mode="elevated">
              <Card.Content style={styles.gap}>
                <Text variant="titleMedium">{t("expense.paidBy")}</Text>
                {expense.payments.map((share) => (
                  <List.Item
                    key={share.participant_id}
                    title={share.display_name}
                    description={`${share.amount} ${expense.converted_currency}`}
                    left={() => <PersonAvatar name={share.display_name} imageUrl={share.avatar_url} />}
                  />
                ))}
                <Divider />
                <Text variant="titleMedium">{t("expense.owedBy")}</Text>
                {expense.owed.map((share) => (
                  <List.Item
                    key={share.participant_id}
                    title={share.display_name}
                    description={`${share.amount} ${expense.converted_currency}`}
                    left={() => <PersonAvatar name={share.display_name} imageUrl={share.avatar_url} />}
                  />
                ))}
              </Card.Content>
            </Card>

            {expense.deleted_at ? (
              <Text variant="bodyMedium">{t("expense.deleted")}</Text>
            ) : (
              <Button mode="elevated" icon="delete-outline" textColor="#B3261E" onPress={() => setConfirmDelete(true)}>
                {t("expense.delete")}
              </Button>
            )}
          </>
        ) : null}
      </Screen>

      <Portal>
        <Dialog visible={confirmDelete} onDismiss={() => setConfirmDelete(false)}>
          <Dialog.Title>{t("expense.delete")}</Dialog.Title>
          <Dialog.Content>
            <Text>{t("expense.deleteConfirm")}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDelete(false)}>{t("common.cancel")}</Button>
            <Button onPress={deleteExpense}>{t("common.delete")}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

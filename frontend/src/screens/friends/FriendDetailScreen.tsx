import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Card, List, Text, TextInput, TouchableRipple } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { asNumber, balanceText } from "../../shared/lib/money";
import { PendingMutation, syncPendingMutations } from "../../shared/sync/queue";
import { Friend, LedgerItem } from "../../shared/types/models";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ExpenseLedgerRow } from "../../shared/ui/ExpenseLedgerRow";
import { MoneyText } from "../../shared/ui/MoneyText";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

export function FriendDetailScreen({ route, navigation }: any) {
  const { t } = useI18n();
  const { api } = useAuth();
  const { showSuccess } = useFeedback();
  const friendshipId = route.params.id;
  const [friend, setFriend] = useState<Friend | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<PendingMutation[]>([]);
  const [settleAmount, setSettleAmount] = useState("");

  async function load() {
    const [detail, ledgerRows] = await Promise.all([
      api.get<Friend>(`/api/friends/${friendshipId}/`),
      api.get<LedgerItem[]>(`/api/friends/${friendshipId}/ledger/`)
    ]);
    setFriend(detail);
    setLedger(ledgerRows);
    const pendingRows = await syncPendingMutations.list();
    setPendingExpenses(
      pendingRows.filter((mutation) => {
        const payload = mutation.payload as any;
        return payload?.context_type === "friendship" && payload?.context_id === friendshipId;
      })
    );
  }

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => load().catch(() => undefined));
    return unsubscribe;
  }, [navigation, friendshipId]);

  async function settle() {
    if (!friend) return;
    const currentOwesFriend = asNumber(friend.balance) < 0;
    await api.post(`/api/friends/${friendshipId}/settlements/`, {
      payer_participant_id: currentOwesFriend ? friend.current_participant_id : friend.participant_id,
      receiver_participant_id: currentOwesFriend ? friend.participant_id : friend.current_participant_id,
      amount: settleAmount
    });
    setSettleAmount("");
    showSuccess({ icon: "cash-check" });
    await load();
  }

  async function deletePendingExpense(id: string) {
    await syncPendingMutations.remove(id);
    await load();
  }

  async function retryPendingExpenses() {
    await syncPendingMutations.flush(api);
    await load();
  }

  return (
    <Screen>
      <Text variant="headlineSmall">{friend?.display_name ?? t("friend.title")}</Text>
      {friend ? (
        <Card mode="elevated">
          <Card.Content style={styles.gap}>
            <Text variant="titleMedium">{balanceText(t, friend.balance, friend.currency)}</Text>
            <Button
              mode="contained"
              icon="plus"
              onPress={() =>
                navigation.navigate("AddExpense", {
                  contextType: "friendship",
                  contextId: friendshipId,
                  resetKey: Date.now(),
                  returnToPrevious: true
                })
              }
            >
              {t("expense.add")}
            </Button>
          </Card.Content>
        </Card>
      ) : null}
      <Card mode="elevated">
        <Card.Content style={styles.gap}>
          <Text variant="titleMedium">{t("settlement.title")}</Text>
          <TextInput mode="outlined" label={t("expense.amount")} value={settleAmount} onChangeText={setSettleAmount} />
          <Button mode="elevated" disabled={!settleAmount || !friend} onPress={settle}>
            {t("settlement.save")}
          </Button>
        </Card.Content>
      </Card>
      <Text variant="titleLarge">{t("ledger.title")}</Text>
      {pendingExpenses.map((mutation) => {
        const payload = mutation.payload as any;
        const expense = payload?.expense ?? {};
        return (
          <Card key={`pending-${mutation.id}`} mode="elevated" style={styles.card}>
            <TouchableRipple
              style={styles.clickable}
              onPress={() =>
                navigation.navigate("AddExpense", {
                  pendingMutationId: mutation.id,
                  resetKey: Date.now(),
                  returnToPrevious: true
                })
              }
            >
              <Card.Content>
                <List.Item
                  style={styles.listTile}
                  title={expense.description || t("expense.add")}
                  description={`${t("expense.pendingSync")} - ${mutation.lastError ?? mutation.status}`}
                  right={() => (
                    <View style={styles.listTileRight}>
                      <Text>{`${expense.amount ?? ""} ${expense.currency ?? friend?.currency ?? ""}`}</Text>
                      <View style={styles.rowActions}>
                        <Button compact mode="text" onPress={() => retryPendingExpenses()}>
                          {t("expense.retrySync")}
                        </Button>
                        <Button compact mode="text" textColor="#B3261E" onPress={() => deletePendingExpense(mutation.id)}>
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
      {ledger.map((item, index) =>
        item.type === "expense" ? (
          <ExpenseLedgerRow
            key={`expense-${item.expense.id}`}
            expense={item.expense}
            currentParticipantId={friend?.current_participant_id}
            t={t}
            onPress={() => navigation.navigate("ExpenseDetail", { id: item.expense.id })}
          />
        ) : (
          <Card key={`${item.type}-${index}`} mode="elevated" style={styles.card}>
            <TouchableRipple
              style={styles.clickable}
              onPress={() => navigation.navigate("SettlementDetail", { id: item.settlement.id })}
            >
              <Card.Content>
                <List.Item
                  style={styles.listTile}
                  title={t("settlement.title")}
                  description={t("settlement.line")
                    .replace("{from}", item.settlement.payer_display_name ?? "")
                    .replace("{to}", item.settlement.receiver_display_name ?? "")
                    .replace("{amount}", `${item.settlement.amount} ${item.settlement.currency}`)}
                  right={() => (
                    <View style={styles.listTileRight}>
                      <MoneyText amount={item.settlement.amount} currency={item.settlement.currency} />
                    </View>
                  )}
                />
              </Card.Content>
            </TouchableRipple>
          </Card>
        )
      )}
      {!ledger.length && !pendingExpenses.length ? <EmptyState text={t("expense.empty")} /> : null}
    </Screen>
  );
}

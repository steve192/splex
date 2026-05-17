import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Card, Text, TextInput } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { OverviewStackParamList } from "../../application/navigationTypes";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { PendingExpenseList } from "../../shared/ledger/PendingExpenseList";
import { pendingExpensesForContext, removePendingExpense, retryPendingExpenses as retryPendingExpenseSync } from "../../shared/ledger/pendingExpenses";
import { SettlementLedgerRow } from "../../shared/ledger/SettlementLedgerRow";
import { asNumber, balanceText } from "../../shared/lib/money";
import { PendingMutation } from "../../shared/sync/queue";
import { Friend, LedgerItem } from "../../shared/types/models";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ExpenseLedgerRow } from "../../shared/ui/ExpenseLedgerRow";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

type FriendDetailScreenProps = NativeStackScreenProps<OverviewStackParamList, "FriendDetail">;

export function FriendDetailScreen({ route, navigation }: FriendDetailScreenProps) {
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
    setPendingExpenses(await pendingExpensesForContext("friendship", friendshipId));
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
    await removePendingExpense(id);
    await load();
  }

  async function retryPendingExpenses() {
    await retryPendingExpenseSync(api);
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
      <PendingExpenseList
        mutations={pendingExpenses}
        fallbackCurrency={friend?.currency}
        t={t}
        onOpen={(mutationId) =>
          navigation.navigate("AddExpense", {
            pendingMutationId: mutationId,
            resetKey: Date.now(),
            returnToPrevious: true
          })
        }
        onRetry={retryPendingExpenses}
        onDelete={deletePendingExpense}
      />
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
          <SettlementLedgerRow
            key={`settlement-${item.settlement.id || index}`}
            settlement={item.settlement}
            t={t}
            onPress={() => navigation.navigate("SettlementDetail", { id: item.settlement.id })}
          />
        )
      )}
      {!ledger.length && !pendingExpenses.length ? <EmptyState text={t("expense.empty")} /> : null}
    </Screen>
  );
}

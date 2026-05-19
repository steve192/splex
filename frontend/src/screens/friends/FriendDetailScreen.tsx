import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, View } from "react-native";
import { Button, Card, Portal, Text, useTheme } from "react-native-paper";

import { OverviewStackParamList } from "../../application/navigationTypes";
import { useAuth } from "../../features/auth/AuthContext";
import { appImages } from "../../shared/assets/images";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { PendingExpenseList } from "../../shared/ledger/PendingExpenseList";
import { pendingExpensesForContext, removePendingExpense, retryPendingExpenses as retryPendingExpenseSync } from "../../shared/ledger/pendingExpenses";
import { SettlementDialog, SettlementDialogTarget } from "../../shared/ledger/SettlementDialog";
import { SettlementLedgerRow } from "../../shared/ledger/SettlementLedgerRow";
import { loadCachedFriendDetail, saveCachedFriendDetail } from "../../shared/lib/offlineCache";
import { asNumber, formatMoney } from "../../shared/lib/money";
import { PendingMutation } from "../../shared/sync/queue";
import { Friend, LedgerItem } from "../../shared/types/models";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ExpenseLedgerRow } from "../../shared/ui/ExpenseLedgerRow";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { negativeColor, positiveColor } from "../../shared/ui/colors";
import { styles } from "../../shared/ui/styles";

type FriendDetailScreenProps = NativeStackScreenProps<OverviewStackParamList, "FriendDetail">;

export function FriendDetailScreen({ route, navigation }: FriendDetailScreenProps) {
  const { t } = useI18n();
  const { api, user } = useAuth();
  const { showSuccess } = useFeedback();
  const theme = useTheme();
  const friendshipId = route.params.id;
  const [friend, setFriend] = useState<Friend | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<PendingMutation[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [settleTarget, setSettleTarget] = useState<SettlementDialogTarget | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleCurrency, setSettleCurrency] = useState("EUR");
  const balanceSummary = useMemo(() => asNumber(friend?.balance), [friend?.balance]);

  async function load(offset = 0) {
    if (loadingMore && offset) return;
    if (offset) setLoadingMore(true);
    setPendingExpenses(await pendingExpensesForContext("friendship", friendshipId));
    try {
      const [detail, ledgerResponse] = await Promise.all([
        api.get<Friend>(`/api/friends/${friendshipId}/`),
        api.get<{ results: LedgerItem[]; next_offset: number | null }>(
          `/api/friends/${friendshipId}/ledger/?offset=${offset}&limit=30`
        )
      ]);
      setFriend(detail);
      setLedger((current) => (offset ? [...current, ...ledgerResponse.results] : ledgerResponse.results));
      setNextOffset(ledgerResponse.next_offset);
      if (!offset) {
        await saveCachedFriendDetail(friendshipId, { detail, ledger: ledgerResponse.results });
      }
    } catch {
      if (offset) return;
      const cached = await loadCachedFriendDetail(friendshipId);
      if (!cached) throw new Error("missing cached friend detail");
      setFriend(cached.detail);
      setLedger(cached.ledger);
      setNextOffset(null);
    } finally {
      if (offset) setLoadingMore(false);
    }
  }

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => load().catch(() => undefined));
    return unsubscribe;
  }, [navigation, friendshipId]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.inline}>
          <PersonAvatar name={friend?.display_name ?? t("friend.title")} imageUrl={friend?.avatar_url} size={30} />
          <Text variant="titleMedium">{friend?.display_name ?? t("friend.title")}</Text>
        </View>
      )
    });
  }, [friend, navigation, t]);

  async function settle() {
    if (!friend || !settleTarget) return;
    await api.post(`/api/friends/${friendshipId}/settlements/`, {
      payer_participant_id: settleTarget.payer_participant_id,
      receiver_participant_id: settleTarget.receiver_participant_id,
      amount: settleAmount,
      currency: settleCurrency
    });
    setSettleTarget(null);
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

  function openSettlementDialog() {
    if (!friend || !friend.current_participant_id || balanceSummary === 0) return;
    const currentOwesFriend = balanceSummary < 0;
    const currentName = user?.display_name ?? t("common.you");
    setSettleTarget({
      payer_participant_id: currentOwesFriend ? friend.current_participant_id : friend.participant_id,
      payer_display_name: currentOwesFriend ? currentName : friend.display_name,
      payer_avatar_url: currentOwesFriend ? user?.avatar_url : friend.avatar_url,
      receiver_participant_id: currentOwesFriend ? friend.participant_id : friend.current_participant_id,
      receiver_display_name: currentOwesFriend ? friend.display_name : currentName,
      receiver_avatar_url: currentOwesFriend ? friend.avatar_url : user?.avatar_url,
      amount: formatMoney(friend.balance),
      currency: friend.currency
    });
    setSettleAmount(formatMoney(friend.balance));
    setSettleCurrency(friend.currency);
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (loadingMore || nextOffset === null) return;
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const remaining = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (remaining < 320) {
      load(nextOffset).catch(() => undefined);
    }
  }

  return (
    <View style={styles.flex}>
      <Screen scrollViewProps={{ onScroll: handleScroll }}>
        <View style={styles.rowActions}>
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
          <Button mode="elevated" icon="cash-check" disabled={!friend || balanceSummary === 0} onPress={openSettlementDialog}>
            {t("settlement.settle")}
          </Button>
        </View>

        {friend ? (
          <Card mode="elevated" style={styles.card}>
            <Card.Content style={styles.gap}>
              {balanceSummary !== 0 ? (
                <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
                  {balanceSummary > 0 ? t("balance.summaryGetting") : t("balance.summaryOweTotal")}{" "}
                  <Text
                    variant="titleLarge"
                    style={{
                      color: balanceSummary > 0 ? positiveColor(theme) : negativeColor(theme),
                      fontWeight: "700"
                    }}
                  >
                    {formatMoney(balanceSummary)} {friend.currency}
                  </Text>
                </Text>
              ) : (
                <Text variant="titleLarge" style={{ color: theme.colors.onSurfaceVariant, fontWeight: "700" }}>
                  {t("balance.summarySettled")}
                </Text>
              )}
              {balanceSummary > 0 ? (
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                  {t("balance.summaryOwesYou").replace("{person}", friend.display_name)}{" "}
                  <Text variant="bodyMedium" style={{ color: positiveColor(theme), fontWeight: "700" }}>
                    {formatMoney(balanceSummary)} {friend.currency}
                  </Text>
                </Text>
              ) : null}
              {balanceSummary < 0 ? (
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                  {t("balance.summaryYouOwe").replace("{person}", friend.display_name)}{" "}
                  <Text variant="bodyMedium" style={{ color: negativeColor(theme), fontWeight: "700" }}>
                    {formatMoney(balanceSummary)} {friend.currency}
                  </Text>
                </Text>
              ) : null}
            </Card.Content>
          </Card>
        ) : null}

        <Text variant="titleLarge">{t("group.expenses")}</Text>
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
        {!ledger.length && !pendingExpenses.length ? (
          <EmptyState image={appImages.emptyExpenses} text={t("expense.empty")} />
        ) : null}
        {nextOffset !== null ? (
          <Button mode="text" loading={loadingMore} onPress={() => load(nextOffset)}>
            {t("activity.loadMore")}
          </Button>
        ) : null}
      </Screen>

      <Portal>
        <SettlementDialog
          visible={!!settleTarget}
          target={settleTarget}
          amount={settleAmount}
          currency={settleCurrency}
          t={t}
          onAmountChange={setSettleAmount}
          onCurrencyChange={setSettleCurrency}
          onDismiss={() => setSettleTarget(null)}
          onSave={settle}
        />
      </Portal>
    </View>
  );
}

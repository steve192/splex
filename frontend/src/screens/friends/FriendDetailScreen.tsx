import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Button, IconButton, Portal, Snackbar, Text } from "react-native-paper";

import { OverviewStackParamList } from "../../application/navigationTypes";
import { useAuth } from "../../features/auth/AuthContext";
import { appImages } from "../../shared/assets/images";
import { apiErrorMessage } from "../../shared/lib/apiErrors";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { PendingExpenseList } from "../../shared/ledger/PendingExpenseList";
import { pendingExpensesForContext, removePendingExpense, retryPendingExpenses as retryPendingExpenseSync } from "../../shared/ledger/pendingExpenses";
import { SettlementDialog, SettlementDialogTarget } from "../../shared/ledger/SettlementDialog";
import { SettlementLedgerRow } from "../../shared/ledger/SettlementLedgerRow";
import { useInfiniteScroll } from "../../shared/ledger/useInfiniteScroll";
import { cachedGet } from "../../shared/lib/offlineCache";
import { asNumber, formatMoney } from "../../shared/lib/money";
import { PendingMutation } from "../../shared/sync/queue";
import { Friend, LedgerItem } from "../../shared/types/models";
import { BalanceLine, BalanceSummaryCard } from "../../shared/ui/BalanceSummaryCard";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ExpenseLedgerRow } from "../../shared/ui/ExpenseLedgerRow";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

type FriendDetailScreenProps = NativeStackScreenProps<OverviewStackParamList, "FriendDetail">;

export function FriendDetailScreen({ route, navigation }: FriendDetailScreenProps) {
  const { t } = useI18n();
  const { api, user } = useAuth();
  const { showSuccess } = useFeedback();
  const friendshipId = route.params.id;
  const [friend, setFriend] = useState<Friend | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<PendingMutation[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [settleTarget, setSettleTarget] = useState<SettlementDialogTarget | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleCurrency, setSettleCurrency] = useState("EUR");
  const [snackbar, setSnackbar] = useState("");
  const balanceSummary = useMemo(() => asNumber(friend?.balance), [friend?.balance]);

  async function load(offset = 0) {
    if (loadingMore && offset) return;
    if (offset) setLoadingMore(true);
    setPendingExpenses(await pendingExpensesForContext("friendship", friendshipId));
    try {
      const ledgerPath = `/api/friends/${friendshipId}/ledger/?offset=${offset}&limit=30`;
      const [detail, ledgerResponse] = await Promise.all([
        cachedGet<Friend>(api, `/api/friends/${friendshipId}/`),
        offset
          ? api.get<{ results: LedgerItem[]; next_offset: number | null }>(ledgerPath)
          : cachedGet<{ results: LedgerItem[]; next_offset: number | null }>(api, ledgerPath)
      ]);
      setFriend(detail);
      setLedger((current) => (offset ? [...current, ...ledgerResponse.results] : ledgerResponse.results));
      setNextOffset(ledgerResponse.next_offset);
    } finally {
      if (offset) setLoadingMore(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [friendshipId])
  );

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.inline}>
          <PersonAvatar name={friend?.display_name ?? t("friend.title")} imageUrl={friend?.avatar_url} size={30} />
          <Text variant="titleMedium">{friend?.display_name ?? t("friend.title")}</Text>
        </View>
      ),
      headerRight: () => (
        <IconButton
          icon="chart-bar"
          onPress={() => navigation.navigate("FriendStatistics", { id: friendshipId })}
        />
      )
    });
  }, [friend, friendshipId, navigation, t]);

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

  async function remindToSettle() {
    if (!friend) return;
    try {
      const result = await api.post<{ sent: boolean }>(
        `/api/friends/${friendshipId}/reminders/settle/`,
        { amount: formatMoney(friend.balance), currency: friend.default_currency }
      );
      setSnackbar(
        result.sent
          ? t("settlement.reminderSent", { person: friend.display_name })
          : t("settlement.reminderNoPush", { person: friend.display_name })
      );
    } catch (error) {
      setSnackbar(apiErrorMessage(error, t));
    }
  }

  async function remindToTrackExpenses() {
    if (!friend) return;
    try {
      const result = await api.post<{ sent: boolean }>(
        `/api/friends/${friendshipId}/reminders/track-expense/`,
        {}
      );
      setSnackbar(
        result.sent
          ? t("invite.trackReminderSent", { count: 1 })
          : t("invite.trackReminderNoPush")
      );
    } catch (error) {
      setSnackbar(apiErrorMessage(error, t));
    }
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
      currency: friend.default_currency
    });
    setSettleAmount(formatMoney(friend.balance));
    setSettleCurrency(friend.default_currency);
  }

  const handleScroll = useInfiniteScroll({
    loadingMore,
    nextOffset,
    onLoadMore: (offset) => load(offset).catch(() => undefined)
  });

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
          <Button
            mode="elevated"
            icon="bell-outline"
            disabled={!friend || balanceSummary <= 0}
            onPress={remindToSettle}
          >
            {t("settlement.remind")}
          </Button>
          <Button
            mode="elevated"
            icon="bell-outline"
            disabled={!friend}
            onPress={remindToTrackExpenses}
          >
            {t("invite.trackReminder")}
          </Button>
        </View>

        {friend ? (
          <BalanceSummaryCard
            total={balanceSummary}
            currency={friend.default_currency}
            detailLines={
              balanceSummary > 0 ? (
                <BalanceLine
                  variant="incoming"
                  person={friend.display_name}
                  amount={formatMoney(balanceSummary)}
                  currency={friend.default_currency}
                />
              ) : balanceSummary < 0 ? (
                <BalanceLine
                  variant="outgoing"
                  person={friend.display_name}
                  amount={formatMoney(balanceSummary)}
                  currency={friend.default_currency}
                />
              ) : null
            }
          />
        ) : null}

        <Text variant="titleLarge">{t("group.expenses")}</Text>
        <PendingExpenseList
          mutations={pendingExpenses}
          fallbackCurrency={friend?.default_currency}
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
              onPress={() => navigation.navigate("ExpenseDetail", { id: item.expense.id })}
            />
          ) : (
            <SettlementLedgerRow
              key={`settlement-${item.settlement.id || index}`}
              settlement={item.settlement}
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
          onAmountChange={setSettleAmount}
          onCurrencyChange={setSettleCurrency}
          onDismiss={() => setSettleTarget(null)}
          onSave={settle}
        />
      </Portal>
      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar("")} duration={6000}>
        {snackbar}
      </Snackbar>
    </View>
  );
}

import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { Button, IconButton, Portal, Snackbar, Text } from "react-native-paper";

import { OverviewStackParamList } from "../../application/navigationTypes";
import { useAuth } from "../../features/auth/AuthContext";
import { appImages } from "../../shared/assets/images";
import { apiErrorMessage } from "../../shared/lib/apiErrors";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { useListSearch } from "../../shared/lib/useListSearch";
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
import { ListSearchbar, headerSearchLayout } from "../../shared/ui/ListSearchbar";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

type FriendDetailScreenProps = NativeStackScreenProps<OverviewStackParamList, "FriendDetail">;

const LEDGER_PAGE_SIZE = 30;

export function FriendDetailScreen({ route, navigation }: Readonly<FriendDetailScreenProps>) {
  const { t } = useI18n();
  const { api, user } = useAuth();
  const { showSuccess } = useFeedback();
  const friendshipId = route.params.id;
  const [friend, setFriend] = useState<Friend | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<PendingMutation[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [loadingMore, setLoadingMore] = useState(false);
  // Tracks how many ledger items are currently shown so a focus refresh can
  // refetch the same amount and keep the scroll position when returning from a
  // pushed screen (e.g. expense details).
  const loadedLedgerCount = useRef(0);
  const [settleTarget, setSettleTarget] = useState<SettlementDialogTarget | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleCurrency, setSettleCurrency] = useState("EUR");
  const [snackbar, setSnackbar] = useState("");
  const search = useListSearch(() => load(0).catch(() => undefined));
  const balanceSummary = useMemo(() => asNumber(friend?.balance), [friend?.balance]);

  async function load(offset = 0, searchTerm = search.termRef.current) {
    if (loadingMore && offset) return;
    if (offset) setLoadingMore(true);
    setPendingExpenses(await pendingExpensesForContext("friendship", friendshipId));
    try {
      const searchQuery = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : "";
      const ledgerPath = `/api/friends/${friendshipId}/ledger/?offset=${offset}&limit=${LEDGER_PAGE_SIZE}${searchQuery}`;
      // Search results bypass the offline cache so stale matches are not
      // persisted; the unfiltered first page stays cached for offline use.
      const ledgerCacheable = !offset && !searchTerm;
      const [detail, ledgerResponse] = await Promise.all([
        cachedGet<Friend>(api, `/api/friends/${friendshipId}/`),
        ledgerCacheable
          ? cachedGet<{ results: LedgerItem[]; next_offset: number | null }>(api, ledgerPath)
          : api.get<{ results: LedgerItem[]; next_offset: number | null }>(ledgerPath)
      ]);
      setFriend(detail);
      setLedger((current) => {
        const next = offset ? [...current, ...ledgerResponse.results] : ledgerResponse.results;
        loadedLedgerCount.current = next.length;
        return next;
      });
      setNextOffset(ledgerResponse.next_offset);
    } finally {
      if (offset) setLoadingMore(false);
    }
  }

  // Reloads as many items as are already shown so returning from a pushed
  // screen does not collapse the list and lose the scroll position. The items
  // are refetched in page-sized chunks (each within the backend's per-request
  // ledger limit) and fired in parallel since the offsets are deterministic.
  async function refresh() {
    setPendingExpenses(await pendingExpensesForContext("friendship", friendshipId));
    const searchTerm = search.termRef.current;
    const searchQuery = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : "";
    const pageCount = Math.max(1, Math.ceil(loadedLedgerCount.current / LEDGER_PAGE_SIZE));
    const [detail, ...pages] = await Promise.all([
      cachedGet<Friend>(api, `/api/friends/${friendshipId}/`),
      ...Array.from({ length: pageCount }, (_unused, index) => {
        const path = `/api/friends/${friendshipId}/ledger/?offset=${index * LEDGER_PAGE_SIZE}&limit=${LEDGER_PAGE_SIZE}${searchQuery}`;
        return index === 0 && !searchTerm
          ? cachedGet<{ results: LedgerItem[]; next_offset: number | null }>(api, path)
          : api.get<{ results: LedgerItem[]; next_offset: number | null }>(path);
      })
    ]);
    const results = pages.flatMap((page) => page.results);
    setFriend(detail);
    setLedger(results);
    loadedLedgerCount.current = results.length;
    setNextOffset(pages.at(-1)?.next_offset ?? null);
  }

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => undefined);
    }, [friendshipId])
  );

  useEffect(() => {
    navigation.setOptions({
      ...headerSearchLayout(search.active),
      headerTitle: () =>
        search.active ? (
          <ListSearchbar value={search.input} onChangeText={search.setInput} onClose={search.close} compact />
        ) : (
          <View style={styles.inline}>
            <PersonAvatar name={friend?.display_name ?? t("friend.title")} imageUrl={friend?.avatar_url} size={30} />
            <Text variant="titleMedium">{friend?.display_name ?? t("friend.title")}</Text>
          </View>
        ),
      headerRight: () =>
        search.active ? null : (
          <View style={{ flexDirection: "row" }}>
            <IconButton icon="magnify" onPress={search.open} />
            <IconButton
              icon="chart-bar"
              onPress={() => navigation.navigate("FriendStatistics", { id: friendshipId })}
            />
            <IconButton
              icon="cog-outline"
              onPress={() => navigation.navigate("FriendSettings", { id: friendshipId })}
            />
          </View>
        )
    });
  }, [friend, friendshipId, navigation, t, search.active, search.input]);

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
    if (!friend?.current_participant_id || balanceSummary === 0) return;
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
              balanceSummary === 0 ? null : (
                <BalanceLine
                  variant={balanceSummary > 0 ? "incoming" : "outgoing"}
                  person={friend.display_name}
                  amount={formatMoney(balanceSummary)}
                  currency={friend.default_currency}
                />
              )
            }
          />
        ) : null}

        <Text variant="titleLarge">{t("group.expenses")}</Text>
        {!search.term && (
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
        )}
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
        {!ledger.length && (search.term ? (
          <EmptyState image={appImages.emptyExpenses} text={t("common.noResults")} />
        ) : !pendingExpenses.length ? (
          <EmptyState image={appImages.emptyExpenses} text={t("expense.empty")} />
        ) : null)}
        {nextOffset !== null && (
          <Button mode="text" loading={loadingMore} onPress={() => load(nextOffset)}>
            {t("activity.loadMore")}
          </Button>
        )}
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

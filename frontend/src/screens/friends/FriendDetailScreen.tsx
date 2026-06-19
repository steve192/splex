import { useNetInfo } from "@react-native-community/netinfo";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import {
  ActivityIndicator,
  Button,
  IconButton,
  Portal,
  Text,
} from "react-native-paper";

import { OverviewStackParamList } from "../../application/navigationTypes";
import { useAuth } from "../../features/auth/AuthContext";
import { apiWriteErrorMessage } from "../../shared/lib/apiErrors";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useSnackbar } from "../../shared/feedback/SnackbarContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { LedgerList } from "../../shared/ledger/LedgerList";
import {
  LEDGER_PAGE_SIZE,
  fetchLedgerPage,
} from "../../shared/ledger/ledgerApi";
import { PendingExpenseList } from "../../shared/ledger/PendingExpenseList";
import { usePendingExpenses } from "../../shared/ledger/usePendingExpenses";
import {
  SettlementDialog,
  SettlementDialogTarget,
} from "../../shared/ledger/SettlementDialog";
import { useInfiniteScroll } from "../../shared/ledger/useInfiniteScroll";
import { useCachedQuery } from "../../shared/lib/useCachedQuery";
import { asNumber, formatMoney } from "../../shared/lib/money";
import {
  canUseOnlineSearch,
  useListSearch,
} from "../../shared/lib/useListSearch";
import { usePaginatedFeed } from "../../shared/lib/usePaginatedFeed";
import { usePendingAction } from "../../shared/lib/usePendingAction";
import { Friend, LedgerItem } from "../../shared/types/models";
import {
  BalanceLine,
  BalanceSummaryCard,
} from "../../shared/ui/BalanceSummaryCard";
import {
  ListSearchbar,
  headerSearchLayout,
} from "../../shared/ui/ListSearchbar";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

type FriendDetailScreenProps = NativeStackScreenProps<
  OverviewStackParamList,
  "FriendDetail"
>;
type FriendDetailAction = "settle" | "settle-reminder" | "track-reminder";

export function FriendDetailScreen({
  route,
  navigation,
}: Readonly<FriendDetailScreenProps>) {
  const { t } = useI18n();
  const { api, user } = useAuth();
  const { showSuccess } = useFeedback();
  const { showSnackbar } = useSnackbar();
  const { hasPending, isPending, runPendingAction } =
    usePendingAction<FriendDetailAction>();
  const friendshipId = route.params.id;
  const [settleTarget, setSettleTarget] =
    useState<SettlementDialogTarget | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleCurrency, setSettleCurrency] = useState("EUR");
  const netInfo = useNetInfo();
  const showOfflineSearchMessage = useCallback(
    () => showSnackbar(t("search.offline")),
    [showSnackbar, t],
  );
  const search = useListSearch({
    canOpen: canUseOnlineSearch(netInfo),
    onBlockedOpen: showOfflineSearchMessage,
  });
  const friendQuery = useCachedQuery<Friend>({
    load: useCallback(
      ({ cachedGet }) =>
        cachedGet<Friend>(api, `/api/friends/${friendshipId}/`),
      [api, friendshipId],
    ),
  });
  const friend = friendQuery.data;
  const balanceSummary = useMemo(
    () => asNumber(friend?.balance),
    [friend?.balance],
  );

  const ledger = usePaginatedFeed<LedgerItem>({
    pageSize: LEDGER_PAGE_SIZE,
    searchTerm: search.term,
    fetchPage: (params) =>
      fetchLedgerPage(api, "friends", friendshipId, params),
  });

  // Reload the ledger and the friend's balance after a mutation (settle, or a
  // pending draft removed/synced) that can change either.
  const reload = useCallback(async () => {
    await Promise.all([ledger.load(0), friendQuery.reload()]);
  }, [ledger.load, friendQuery.reload]);

  const pending = usePendingExpenses("friendship", friendshipId, reload);

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        ledger.refresh(),
        pending.refresh(),
        friendQuery.reload(),
      ]).catch(() => undefined);
    }, [ledger.refresh, pending.refresh, friendQuery.reload]),
  );

  useEffect(() => {
    navigation.setOptions({
      ...headerSearchLayout(search.active),
      headerTitle: () =>
        search.active ? (
          <ListSearchbar
            value={search.input}
            onChangeText={search.setInput}
            onClose={search.close}
            compact
          />
        ) : (
          <View style={styles.inline}>
            <PersonAvatar
              name={friend?.display_name ?? t("friend.title")}
              imageUrl={friend?.avatar_url}
              size={30}
            />
            <Text variant="titleMedium">
              {friend?.display_name ?? t("friend.title")}
            </Text>
          </View>
        ),
      headerRight: () =>
        search.active ? null : (
          <View style={{ flexDirection: "row" }}>
            <IconButton icon="magnify" onPress={search.open} />
            <IconButton
              icon="chart-bar"
              onPress={() =>
                navigation.navigate("FriendStatistics", { id: friendshipId })
              }
            />
            <IconButton
              icon="cog-outline"
              onPress={() =>
                navigation.navigate("FriendSettings", { id: friendshipId })
              }
            />
          </View>
        ),
    });
  }, [
    friend,
    friendshipId,
    navigation,
    search.active,
    search.close,
    search.input,
    search.open,
    search.setInput,
    t,
  ]);

  async function settle() {
    if (!friend || !settleTarget) return;
    await runPendingAction("settle", async () => {
      try {
        await api.post(`/api/friends/${friendshipId}/settlements/`, {
          payer_participant_id: settleTarget.payer_participant_id,
          receiver_participant_id: settleTarget.receiver_participant_id,
          amount: settleAmount,
          currency: settleCurrency,
        });
        setSettleTarget(null);
        setSettleAmount("");
        await reload();
      } catch (error) {
        setSettleTarget(null);
        showSnackbar(apiWriteErrorMessage(error, t));
        return;
      }
      showSuccess({ icon: "cash-check" });
    });
  }

  async function remindToSettle() {
    if (!friend) return;
    await runPendingAction("settle-reminder", async () => {
      try {
        const result = await api.post<{ sent: boolean }>(
          `/api/friends/${friendshipId}/reminders/settle/`,
          {
            amount: formatMoney(friend.balance),
            currency: friend.default_currency,
          },
        );
        showSnackbar(
          result.sent
            ? t("settlement.reminderSent", { person: friend.display_name })
            : t("settlement.reminderNoPush", { person: friend.display_name }),
        );
      } catch (error) {
        showSnackbar(apiWriteErrorMessage(error, t));
      }
    });
  }

  async function remindToTrackExpenses() {
    if (!friend) return;
    await runPendingAction("track-reminder", async () => {
      try {
        const result = await api.post<{ sent: boolean }>(
          `/api/friends/${friendshipId}/reminders/track-expense/`,
          {},
        );
        showSnackbar(
          result.sent
            ? t("invite.trackReminderSent", { count: 1 })
            : t("invite.trackReminderNoPush"),
        );
      } catch (error) {
        showSnackbar(apiWriteErrorMessage(error, t));
      }
    });
  }

  function openSettlementDialog() {
    if (!friend?.current_participant_id || balanceSummary === 0) return;
    const currentOwesFriend = balanceSummary < 0;
    const currentName = user?.display_name ?? t("common.you");
    setSettleTarget({
      payer_participant_id: currentOwesFriend
        ? friend.current_participant_id
        : friend.participant_id,
      payer_display_name: currentOwesFriend ? currentName : friend.display_name,
      payer_avatar_url: currentOwesFriend
        ? user?.avatar_url
        : friend.avatar_url,
      receiver_participant_id: currentOwesFriend
        ? friend.participant_id
        : friend.current_participant_id,
      receiver_display_name: currentOwesFriend
        ? friend.display_name
        : currentName,
      receiver_avatar_url: currentOwesFriend
        ? friend.avatar_url
        : user?.avatar_url,
      amount: formatMoney(friend.balance),
      currency: friend.default_currency,
    });
    setSettleAmount(formatMoney(friend.balance));
    setSettleCurrency(friend.default_currency);
  }

  const handleScroll = useInfiniteScroll({
    loadingMore: ledger.loadingMore,
    nextOffset: ledger.nextOffset,
    onLoadMore: (offset) => ledger.load(offset).catch(() => undefined),
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
                returnToPrevious: true,
              })
            }
          >
            {t("expense.add")}
          </Button>
          <Button
            mode="elevated"
            icon="cash-check"
            disabled={hasPending || !friend || balanceSummary === 0}
            onPress={openSettlementDialog}
          >
            {t("settlement.settle")}
          </Button>
          <Button
            mode="elevated"
            icon="bell-outline"
            loading={isPending("settle-reminder")}
            disabled={hasPending || !friend || balanceSummary <= 0}
            onPress={remindToSettle}
          >
            {t("settlement.remind")}
          </Button>
          <Button
            mode="elevated"
            icon="bell-outline"
            loading={isPending("track-reminder")}
            disabled={hasPending || !friend}
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

        <View style={styles.inline}>
          <Text variant="titleLarge">{t("group.expenses")}</Text>
          {(ledger.loadingInitial || friendQuery.loading) && (
            <ActivityIndicator size={16} />
          )}
        </View>
        {!search.term && (
          <PendingExpenseList
            mutations={pending.items}
            fallbackCurrency={friend?.default_currency}
            onOpen={(mutationId) =>
              navigation.navigate("AddExpense", {
                pendingMutationId: mutationId,
                resetKey: Date.now(),
                returnToPrevious: true,
              })
            }
            onRetry={pending.retry}
            onDelete={pending.remove}
          />
        )}
        <LedgerList
          items={ledger.items}
          currentParticipantId={friend?.current_participant_id}
          onOpenExpense={(id) => navigation.navigate("ExpenseDetail", { id })}
          onOpenSettlement={(id) =>
            navigation.navigate("SettlementDetail", { id })
          }
          searching={!!search.term}
          hasPending={pending.items.length > 0}
          nextOffset={ledger.nextOffset}
          loadingInitial={ledger.loadingInitial}
          loadingMore={ledger.loadingMore}
          onLoadMore={ledger.load}
        />
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
          saving={isPending("settle")}
        />
      </Portal>
    </View>
  );
}

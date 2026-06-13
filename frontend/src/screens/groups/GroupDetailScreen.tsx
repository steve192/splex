import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Dialog, IconButton, Portal, SegmentedButtons, Snackbar, Switch, Text, TouchableRipple, useTheme } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { appImages } from "../../shared/assets/images";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { useListSearch } from "../../shared/lib/useListSearch";
import { PendingExpenseList } from "../../shared/ledger/PendingExpenseList";
import { pendingExpensesForContext, removePendingExpense, retryPendingExpenses as retryPendingExpenseSync } from "../../shared/ledger/pendingExpenses";
import { SettlementDialog, SettlementDialogTarget } from "../../shared/ledger/SettlementDialog";
import { SettlementLedgerRow } from "../../shared/ledger/SettlementLedgerRow";
import { useInfiniteScroll } from "../../shared/ledger/useInfiniteScroll";
import { shareLink } from "../../shared/lib/shareLink";
import { cachedGet } from "../../shared/lib/offlineCache";
import { asNumber } from "../../shared/lib/money";
import { apiErrorMessage } from "../../shared/lib/apiErrors";
import { loadSimplifyBalancesPreference, saveSimplifyBalancesPreference } from "../../shared/lib/groupPreferences";
import { PendingMutation } from "../../shared/sync/queue";
import { BalanceDetail, Group, GroupBalance, LedgerItem } from "../../shared/types/models";
import { OverviewStackParamList } from "../../application/navigationTypes";
import { BalanceGraph } from "../../shared/ui/BalanceGraph";
import { BalanceMemberCard } from "../../shared/ui/BalanceMemberCard";
import { BalanceLine, BalanceSummaryCard } from "../../shared/ui/BalanceSummaryCard";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ExpenseLedgerRow } from "../../shared/ui/ExpenseLedgerRow";
import { ManualCopyDialog } from "../../shared/ui/ManualCopyDialog";
import { ImageViewerModal } from "../../shared/ui/ImageViewerModal";
import { ListSearchbar, headerSearchLayout } from "../../shared/ui/ListSearchbar";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

type GroupDetailScreenProps = NativeStackScreenProps<OverviewStackParamList, "GroupDetail">;

const LEDGER_PAGE_SIZE = 30;

export function GroupDetailScreen({ route, navigation }: Readonly<GroupDetailScreenProps>) {
  const { t } = useI18n();
  const { api } = useAuth();
  const { showSuccess } = useFeedback();
  const theme = useTheme();
  const groupId = route.params.id;
  const [group, setGroup] = useState<Group | null>(null);
  const [balances, setBalances] = useState<GroupBalance[]>([]);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<PendingMutation[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [loadingMore, setLoadingMore] = useState(false);
  // Tracks how many ledger items are currently shown so a focus refresh can
  // refetch the same amount and keep the scroll position when returning from a
  // pushed screen (e.g. expense details).
  const loadedLedgerCount = useRef(0);
  const [selectedTab, setSelectedTab] = useState("expenses");
  const search = useListSearch(() => load(0).catch(() => undefined));
  const [expandedParticipantIds, setExpandedParticipantIds] = useState<number[]>([]);
  const [settleTarget, setSettleTarget] = useState<SettlementDialogTarget | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleCurrency, setSettleCurrency] = useState("EUR");
  const [snackbar, setSnackbar] = useState("");
  const [manualCopyLink, setManualCopyLink] = useState("");
  const [groupImageVisible, setGroupImageVisible] = useState(false);
  const [simplifyBalances, setSimplifyBalances] = useState(false);
  const [simplifyInfoVisible, setSimplifyInfoVisible] = useState(false);
  const [trackReminderConfirmVisible, setTrackReminderConfirmVisible] = useState(false);
  const balanceSummary = useMemo(
    () => buildBalanceSummary(balances, group?.current_participant_id, group?.default_currency),
    [balances, group?.current_participant_id, group?.default_currency]
  );

  async function load(offset = 0, simplified = simplifyBalances, searchTerm = search.termRef.current) {
    if (loadingMore && offset) return;
    if (offset) setLoadingMore(true);
    setPendingExpenses(await pendingExpensesForContext("group", groupId));
    try {
      const searchQuery = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : "";
      const ledgerPath = `/api/groups/${groupId}/ledger/?offset=${offset}&limit=${LEDGER_PAGE_SIZE}${searchQuery}`;
      const balancesPath = `/api/groups/${groupId}/balances/${
        simplified ? "?simplified=true" : ""
      }`;
      // Search results bypass the offline cache so stale matches are not
      // persisted; the unfiltered first page stays cached for offline use.
      const ledgerCacheable = !offset && !searchTerm;
      const [detail, balanceRows, ledgerResponse] = await Promise.all([
        cachedGet<Group>(api, `/api/groups/${groupId}/`),
        cachedGet<GroupBalance[]>(api, balancesPath),
        ledgerCacheable
          ? cachedGet<{ results: LedgerItem[]; next_offset: number | null }>(api, ledgerPath)
          : api.get<{ results: LedgerItem[]; next_offset: number | null }>(ledgerPath)
      ]);
      setGroup(detail);
      setBalances(balanceRows);
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
  async function refresh(simplified = simplifyBalances) {
    setPendingExpenses(await pendingExpensesForContext("group", groupId));
    const searchTerm = search.termRef.current;
    const searchQuery = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : "";
    const balancesPath = `/api/groups/${groupId}/balances/${
      simplified ? "?simplified=true" : ""
    }`;
    const pageCount = Math.max(1, Math.ceil(loadedLedgerCount.current / LEDGER_PAGE_SIZE));
    const [detail, balanceRows, ...pages] = await Promise.all([
      cachedGet<Group>(api, `/api/groups/${groupId}/`),
      cachedGet<GroupBalance[]>(api, balancesPath),
      ...Array.from({ length: pageCount }, (_unused, index) => {
        const path = `/api/groups/${groupId}/ledger/?offset=${index * LEDGER_PAGE_SIZE}&limit=${LEDGER_PAGE_SIZE}${searchQuery}`;
        return index === 0 && !searchTerm
          ? cachedGet<{ results: LedgerItem[]; next_offset: number | null }>(api, path)
          : api.get<{ results: LedgerItem[]; next_offset: number | null }>(path);
      })
    ]);
    const results = pages.flatMap((page) => page.results);
    setGroup(detail);
    setBalances(balanceRows);
    setLedger(results);
    loadedLedgerCount.current = results.length;
    setNextOffset(pages.at(-1)?.next_offset ?? null);
  }

  useFocusEffect(
    useCallback(() => {
      loadSimplifyBalancesPreference(groupId)
        .then((preference) => {
          setSimplifyBalances(preference);
          return refresh(preference);
        })
        .catch(() => undefined);
    }, [groupId])
  );

  // Searching only applies to the expenses list, so reveal it alongside the
  // searchbar.
  function openSearch() {
    setSelectedTab("expenses");
    search.open();
  }

  async function handleSimplifyToggle(next: boolean) {
    setSimplifyBalances(next);
    await saveSimplifyBalancesPreference(groupId, next);
    await load(0, next);
  }

  useEffect(() => {
    navigation.setOptions({
      ...headerSearchLayout(search.active),
      headerTitle: () =>
        search.active ? (
          <ListSearchbar value={search.input} onChangeText={search.setInput} onClose={search.close} compact />
        ) : (
          <TouchableRipple
            borderless
            onPress={() => group?.icon_url && setGroupImageVisible(true)}
          >
            <View style={styles.inline}>
              <PersonAvatar
                name={group?.name ?? t("group.title")}
                imageUrl={group?.icon_url}
                size={30}
              />
              <Text variant="titleMedium">{group?.name ?? t("group.title")}</Text>
            </View>
          </TouchableRipple>
        ),
      headerRight: () =>
        search.active ? null : (
          <View style={{ flexDirection: "row" }}>
            <IconButton icon="magnify" onPress={openSearch} />
            <IconButton icon="chart-bar" onPress={() => navigation.navigate("GroupStatistics", { id: groupId })} />
            <IconButton icon="cog-outline" onPress={() => navigation.navigate("GroupSettings", { id: groupId })} />
          </View>
        )
    });
  }, [group, groupId, navigation, t, search.active, search.input]);

  async function invite() {
    const response = await api.post<{ url: string }>(`/api/groups/${groupId}/invitations/`, {});
    const result = await shareLink(response.url, { title: t("invite.shareTitle") });
    if (result === "copied") {
      setSnackbar(t("invite.copied"));
    } else if (result === "failed") {
      setManualCopyLink(response.url);
    }
  }

  async function settle() {
    if (!settleTarget) return;
    await api.post(`/api/groups/${groupId}/settlements/`, {
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

  function toggleExpanded(participantId: number) {
    setExpandedParticipantIds((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId]
    );
  }

  function avatarForParticipant(participantId: number) {
    return balances.find((row) => row.participant_id === participantId)?.avatar_url;
  }

  function openSettleDialog(detail: BalanceDetail) {
    setSettleTarget({
      amount: detail.amount,
      currency: detail.currency,
      payer_participant_id: detail.from_participant_id,
      payer_display_name: detail.from_display_name,
      payer_avatar_url: avatarForParticipant(detail.from_participant_id),
      receiver_participant_id: detail.to_participant_id,
      receiver_display_name: detail.to_display_name,
      receiver_avatar_url: avatarForParticipant(detail.to_participant_id)
    });
    setSettleAmount(detail.amount);
    setSettleCurrency(detail.currency);
  }

  async function remindToSettle(row: GroupBalance) {
    // The card-level remind action targets the row owner.  The net amount
    // they owe is stored as a negative number on the row, so we send its
    // absolute value through the API.
    const amount = Math.abs(asNumber(row.amount));
    try {
      const result = await api.post<{ sent: boolean }>(
        `/api/groups/${groupId}/reminders/settle/`,
        {
          participant_id: row.participant_id,
          amount: amount.toFixed(2),
          currency: row.currency
        }
      );
      setSnackbar(
        result.sent
          ? t("settlement.reminderSent", { person: row.display_name })
          : t("settlement.reminderNoPush", { person: row.display_name })
      );
    } catch (error) {
      setSnackbar(apiErrorMessage(error, t));
    }
  }

  async function remindToTrackExpenses() {
    try {
      const result = await api.post<{ recipients: number; sent: number }>(
        `/api/groups/${groupId}/reminders/track-expense/`,
        {}
      );
      let reminderMessage: string;
      if (result.recipients === 0) {
        reminderMessage = t("invite.trackReminderNobody");
      } else if (result.sent === 0) {
        reminderMessage = t("invite.trackReminderNoPush");
      } else {
        reminderMessage = t("invite.trackReminderSent", { count: result.sent });
      }
      setSnackbar(reminderMessage);
    } catch (error) {
      setSnackbar(apiErrorMessage(error, t));
    }
  }

  const handleScroll = useInfiniteScroll({
    enabled: selectedTab === "expenses",
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
            accessibilityLabel={t("expense.add")}
            onPress={() =>
              navigation.navigate("AddExpense", {
                contextType: "group",
                contextId: groupId,
                resetKey: Date.now(),
                returnToPrevious: true
              })
            }
          >
            <MaterialCommunityIcons name="plus" size={18} color={theme.colors.onPrimary} />
          </Button>
          <Button mode="elevated" icon="link-variant" onPress={() => invite()}>
            {t("invite.create")}
          </Button>
          <Button mode="elevated" icon="bell-outline" onPress={() => setTrackReminderConfirmVisible(true)}>
            {t("invite.remind")}
          </Button>
        </View>

        <BalanceSummaryCard
          total={balanceSummary.total}
          currency={balanceSummary.currency}
          detailLines={
            <>
              {balanceSummary.incoming.map((detail) => (
                <BalanceLine
                  key={`incoming-${detail.from_participant_id}-${detail.to_participant_id}`}
                  variant="incoming"
                  person={detail.from_display_name}
                  amount={String(asNumber(detail.amount))}
                  currency={detail.currency}
                />
              ))}
              {balanceSummary.outgoing.map((detail) => (
                <BalanceLine
                  key={`outgoing-${detail.from_participant_id}-${detail.to_participant_id}`}
                  variant="outgoing"
                  person={detail.to_display_name}
                  amount={String(asNumber(detail.amount))}
                  currency={detail.currency}
                />
              ))}
            </>
          }
        />

        <SegmentedButtons
          value={selectedTab}
          onValueChange={setSelectedTab}
          buttons={[
            { value: "expenses", label: t("group.expenses") },
            { value: "balances", label: t("balance.title") }
          ]}
        />

        {selectedTab === "expenses" ? (
          <>
            <Text variant="titleLarge">{t("group.expenses")}</Text>
            {!search.term && (
              <PendingExpenseList
                mutations={pendingExpenses}
                fallbackCurrency={group?.default_currency}
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
            {ledger.length > 0 &&
              ledger.map((item) =>
                item.type === "expense" ? (
                  <ExpenseLedgerRow
                    key={`expense-${item.expense.id}`}
                    expense={item.expense}
                    currentParticipantId={group?.current_participant_id}
                    onPress={() => navigation.navigate("ExpenseDetail", { id: item.expense.id })}
                  />
                ) : (
                  <SettlementLedgerRow
                    key={`settlement-${item.settlement.id}`}
                    settlement={item.settlement}
                    onPress={() => navigation.navigate("SettlementDetail", { id: item.settlement.id })}
                  />
                )
              )}
            {ledger.length === 0 && (search.term ? (
              <EmptyState image={appImages.emptyExpenses} text={t("common.noResults")} />
            ) : pendingExpenses.length === 0 && (
              <EmptyState image={appImages.emptyExpenses} text={t("expense.empty")} />
            ))}
            {nextOffset !== null && (
              <Button mode="text" loading={loadingMore} onPress={() => load(nextOffset)}>
                {t("activity.loadMore")}
              </Button>
            )}
          </>
        ) : (
          <>
            <Text variant="titleLarge">{t("balance.title")}</Text>
            <View style={styles.rowBetween}>
              <View style={styles.inline}>
                <Text variant="bodyMedium">{t("balance.simplifyToggle")}</Text>
                <IconButton
                  icon="information-outline"
                  size={18}
                  onPress={() => setSimplifyInfoVisible(true)}
                  accessibilityLabel={t("balance.simplifyInfoLabel")}
                />
              </View>
              <Switch value={simplifyBalances} onValueChange={handleSimplifyToggle} />
            </View>
            {balances.length ? (
              balances.map((row) => (
                <BalanceMemberCard
                  key={row.participant_id}
                  row={row}
                  expanded={expandedParticipantIds.includes(row.participant_id)}
                  onToggle={() => toggleExpanded(row.participant_id)}
                  onSettle={(detail) => openSettleDialog(detail)}
                  onRemindSettle={(targetRow) => remindToSettle(targetRow)}
                  currentParticipantId={group?.current_participant_id}
                />
              ))
            ) : (
              <EmptyState image={appImages.emptyExpenses} text={t("balance.empty")} />
            )}
            <BalanceGraph rows={balances} />
          </>
        )}
      </Screen>

      <ImageViewerModal
        visible={groupImageVisible}
        title={group?.name ?? ""}
        imageUrl={group?.icon_url}
        onDismiss={() => setGroupImageVisible(false)}
      />
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
        <Dialog
          visible={simplifyInfoVisible}
          onDismiss={() => setSimplifyInfoVisible(false)}
        >
          <Dialog.Title>{t("balance.simplifyInfoTitle")}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t("balance.simplifyInfoBody")}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSimplifyInfoVisible(false)}>{t("common.ok")}</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog
          visible={trackReminderConfirmVisible}
          onDismiss={() => setTrackReminderConfirmVisible(false)}
        >
          <Dialog.Title>{t("invite.trackReminder")}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t("invite.trackReminderConfirm")}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setTrackReminderConfirmVisible(false)}>{t("common.cancel")}</Button>
            <Button
              onPress={() => {
                setTrackReminderConfirmVisible(false);
                remindToTrackExpenses();
              }}
            >
              {t("invite.remind")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar("")} duration={8000}>
        {snackbar}
      </Snackbar>
      <ManualCopyDialog
        visible={!!manualCopyLink}
        title={t("invite.copyManual")}
        description={t("invite.copyManualHelp")}
        value={manualCopyLink}
        label={t("invite.copyLabel")}
        onDismiss={() => setManualCopyLink("")}
      />
    </View>
  );
}

function buildBalanceSummary(
  balances: GroupBalance[],
  currentParticipantId: number | undefined,
  fallbackCurrency: string | undefined
) {
  const currentRow = balances.find((row) => row.participant_id === currentParticipantId);
  const details = currentRow?.details ?? [];
  const incoming = details.filter((detail) => detail.to_participant_id === currentParticipantId);
  const outgoing = details.filter((detail) => detail.from_participant_id === currentParticipantId);
  const incomingTotal = incoming.reduce((sum, detail) => sum + asNumber(detail.amount), 0);
  const outgoingTotal = outgoing.reduce((sum, detail) => sum + asNumber(detail.amount), 0);
  return {
    currency: currentRow?.currency ?? fallbackCurrency ?? "EUR",
    incoming,
    outgoing,
    total: incomingTotal - outgoingTotal
  };
}

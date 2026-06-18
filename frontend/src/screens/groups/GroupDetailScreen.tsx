import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button, Dialog, IconButton, Portal, SegmentedButtons, Snackbar, Switch, Text, TouchableRipple, useTheme } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { appImages } from "../../shared/assets/images";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { LedgerList } from "../../shared/ledger/LedgerList";
import { LEDGER_PAGE_SIZE, fetchLedgerPage } from "../../shared/ledger/ledgerApi";
import { PendingExpenseList } from "../../shared/ledger/PendingExpenseList";
import { usePendingExpenses } from "../../shared/ledger/usePendingExpenses";
import { SettlementDialog, SettlementDialogTarget } from "../../shared/ledger/SettlementDialog";
import { useInfiniteScroll } from "../../shared/ledger/useInfiniteScroll";
import { shareLink } from "../../shared/lib/shareLink";
import { cachedGet } from "../../shared/lib/offlineCache";
import { asNumber } from "../../shared/lib/money";
import { apiErrorMessage } from "../../shared/lib/apiErrors";
import { loadSimplifyBalancesPreference, saveSimplifyBalancesPreference } from "../../shared/lib/groupPreferences";
import { useListSearch } from "../../shared/lib/useListSearch";
import { usePaginatedFeed } from "../../shared/lib/usePaginatedFeed";
import { BalanceDetail, Group, GroupBalance, LedgerItem } from "../../shared/types/models";
import { OverviewStackParamList } from "../../application/navigationTypes";
import { BalanceGraph } from "../../shared/ui/BalanceGraph";
import { BalanceMemberCard } from "../../shared/ui/BalanceMemberCard";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ManualCopyDialog } from "../../shared/ui/ManualCopyDialog";
import { ImageViewerModal } from "../../shared/ui/ImageViewerModal";
import { ListSearchbar, headerSearchLayout } from "../../shared/ui/ListSearchbar";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";
import { GroupBalanceSummaryCard } from "./GroupBalanceSummaryCard";
import { buildBalanceSummary } from "./groupBalanceSummary";

type GroupDetailScreenProps = NativeStackScreenProps<OverviewStackParamList, "GroupDetail">;

export function GroupDetailScreen({ route, navigation }: Readonly<GroupDetailScreenProps>) {
  const { t } = useI18n();
  const { api } = useAuth();
  const { showSuccess } = useFeedback();
  const theme = useTheme();
  const groupId = route.params.id;
  const [group, setGroup] = useState<Group | null>(null);
  const [balances, setBalances] = useState<GroupBalance[]>([]);
  const [selectedTab, setSelectedTab] = useState("expenses");
  const search = useListSearch();
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

  const ledger = usePaginatedFeed<LedgerItem>({
    pageSize: LEDGER_PAGE_SIZE,
    searchTerm: search.term,
    fetchPage: (params) => fetchLedgerPage(api, "groups", groupId, params)
  });

  const refreshGroup = useCallback(
    async (simplified: boolean) => {
      const balancesPath = `/api/groups/${groupId}/balances/${simplified ? "?simplified=true" : ""}`;
      const [detail, balanceRows] = await Promise.all([
        cachedGet<Group>(api, `/api/groups/${groupId}/`),
        cachedGet<GroupBalance[]>(api, balancesPath)
      ]);
      setGroup(detail);
      setBalances(balanceRows);
    },
    [api, groupId]
  );

  // Reload the ledger and balances after a mutation (settle, or a pending draft
  // removed/synced) that can change either.
  const reload = useCallback(async () => {
    await Promise.all([ledger.load(0), refreshGroup(simplifyBalances)]);
  }, [ledger.load, refreshGroup, simplifyBalances]);

  const pending = usePendingExpenses("group", groupId, reload);

  useFocusEffect(
    useCallback(() => {
      loadSimplifyBalancesPreference(groupId)
        .then((preference) => {
          setSimplifyBalances(preference);
          return Promise.all([ledger.refresh(), pending.refresh(), refreshGroup(preference)]);
        })
        .catch(() => undefined);
    }, [groupId, ledger.refresh, pending.refresh, refreshGroup])
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
    await refreshGroup(next);
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
    await reload();
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
    loadingMore: ledger.loadingMore,
    nextOffset: ledger.nextOffset,
    onLoadMore: (offset) => ledger.load(offset).catch(() => undefined)
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

        <GroupBalanceSummaryCard summary={balanceSummary} />

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
                mutations={pending.items}
                fallbackCurrency={group?.default_currency}
                onOpen={(mutationId) =>
                  navigation.navigate("AddExpense", {
                    pendingMutationId: mutationId,
                    resetKey: Date.now(),
                    returnToPrevious: true
                  })
                }
                onRetry={pending.retry}
                onDelete={pending.remove}
              />
            )}
            <LedgerList
              items={ledger.items}
              currentParticipantId={group?.current_participant_id}
              onOpenExpense={(id) => navigation.navigate("ExpenseDetail", { id })}
              onOpenSettlement={(id) => navigation.navigate("SettlementDetail", { id })}
              searching={!!search.term}
              hasPending={pending.items.length > 0}
              nextOffset={ledger.nextOffset}
              loadingMore={ledger.loadingMore}
              onLoadMore={ledger.load}
            />
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

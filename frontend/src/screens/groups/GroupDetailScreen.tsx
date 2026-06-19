import { useNetInfo } from "@react-native-community/netinfo";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Button,
  Dialog,
  IconButton,
  Portal,
  SegmentedButtons,
  Switch,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { appImages } from "../../shared/assets/images";
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
import { shareLink } from "../../shared/lib/shareLink";
import { useCachedQuery } from "../../shared/lib/useCachedQuery";
import { asNumber } from "../../shared/lib/money";
import { apiWriteErrorMessage } from "../../shared/lib/apiErrors";
import {
  loadSimplifyBalancesPreference,
  saveSimplifyBalancesPreference,
} from "../../shared/lib/groupPreferences";
import { usePendingAction } from "../../shared/lib/usePendingAction";
import {
  canUseOnlineSearch,
  useListSearch,
} from "../../shared/lib/useListSearch";
import { usePaginatedFeed } from "../../shared/lib/usePaginatedFeed";
import {
  BalanceDetail,
  Group,
  GroupBalance,
  LedgerItem,
} from "../../shared/types/models";
import { OverviewStackParamList } from "../../application/navigationTypes";
import { BalanceGraph } from "../../shared/ui/BalanceGraph";
import { BalanceMemberCard } from "../../shared/ui/BalanceMemberCard";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ManualCopyDialog } from "../../shared/ui/ManualCopyDialog";
import { ImageViewerModal } from "../../shared/ui/ImageViewerModal";
import {
  ListSearchbar,
  headerSearchLayout,
} from "../../shared/ui/ListSearchbar";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";
import { GroupBalanceSummaryCard } from "./GroupBalanceSummaryCard";
import { buildBalanceSummary } from "./groupBalanceSummary";

type GroupDetailScreenProps = NativeStackScreenProps<
  OverviewStackParamList,
  "GroupDetail"
>;
type GroupDetailAction =
  | "invite"
  | "settle"
  | "track-reminder"
  | `settle-reminder:${number}`;

export function GroupDetailScreen({
  route,
  navigation,
}: Readonly<GroupDetailScreenProps>) {
  const { t } = useI18n();
  const { api } = useAuth();
  const { showSuccess } = useFeedback();
  const { showSnackbar } = useSnackbar();
  const {
    hasPending,
    isPending,
    pending: pendingAction,
    runPendingAction,
  } = usePendingAction<GroupDetailAction>();
  const theme = useTheme();
  const groupId = route.params.id;
  const [selectedTab, setSelectedTab] = useState("expenses");
  const [expandedParticipantIds, setExpandedParticipantIds] = useState<
    number[]
  >([]);
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
  const [manualCopyLink, setManualCopyLink] = useState("");
  const [groupImageVisible, setGroupImageVisible] = useState(false);
  const [simplifyBalances, setSimplifyBalances] = useState(false);
  const simplifyBalancesRef = useRef(simplifyBalances);
  const [simplifyInfoVisible, setSimplifyInfoVisible] = useState(false);
  const [trackReminderConfirmVisible, setTrackReminderConfirmVisible] =
    useState(false);
  const groupQuery = useCachedQuery<{ group: Group; balances: GroupBalance[] }>(
    {
      load: useCallback(
        async ({ cachedGet }) => {
          const simplified = simplifyBalancesRef.current;
          const balancesPath = `/api/groups/${groupId}/balances/${simplified ? "?simplified=true" : ""}`;
          const [group, balances] = await Promise.all([
            cachedGet<Group>(api, `/api/groups/${groupId}/`),
            cachedGet<GroupBalance[]>(api, balancesPath),
          ]);
          return { group, balances };
        },
        [api, groupId],
      ),
    },
  );
  const group = groupQuery.data?.group ?? null;
  const balances = groupQuery.data?.balances ?? [];
  const balanceSummary = useMemo(
    () =>
      buildBalanceSummary(
        balances,
        group?.current_participant_id,
        group?.default_currency,
      ),
    [balances, group?.current_participant_id, group?.default_currency],
  );
  const pendingReminderParticipantId = pendingAction?.startsWith(
    "settle-reminder:",
  )
    ? Number(pendingAction.split(":")[1])
    : null;

  const ledger = usePaginatedFeed<LedgerItem>({
    pageSize: LEDGER_PAGE_SIZE,
    searchTerm: search.term,
    fetchPage: (params) => fetchLedgerPage(api, "groups", groupId, params),
  });

  // Reload the ledger and balances after a mutation (settle, or a pending draft
  // removed/synced) that can change either.
  const reload = useCallback(async () => {
    await Promise.all([ledger.load(0), groupQuery.reload()]);
  }, [ledger.load, groupQuery.reload]);

  const pending = usePendingExpenses("group", groupId, reload);

  useFocusEffect(
    useCallback(() => {
      loadSimplifyBalancesPreference(groupId)
        .then((preference) => {
          simplifyBalancesRef.current = preference;
          setSimplifyBalances(preference);
          return Promise.all([
            ledger.refresh(),
            pending.refresh(),
            groupQuery.reload(),
          ]);
        })
        .catch(() => undefined);
    }, [groupId, ledger.refresh, pending.refresh, groupQuery.reload]),
  );

  // Searching only applies to the expenses list, so reveal it alongside the
  // searchbar.
  const openSearch = useCallback(() => {
    setSelectedTab("expenses");
    search.open();
  }, [search.open]);

  async function handleSimplifyToggle(next: boolean) {
    simplifyBalancesRef.current = next;
    setSimplifyBalances(next);
    await saveSimplifyBalancesPreference(groupId, next);
    await groupQuery.reload();
  }

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
              <Text variant="titleMedium">
                {group?.name ?? t("group.title")}
              </Text>
            </View>
          </TouchableRipple>
        ),
      headerRight: () =>
        search.active ? null : (
          <View style={{ flexDirection: "row" }}>
            <IconButton icon="magnify" onPress={openSearch} />
            <IconButton
              icon="chart-bar"
              onPress={() =>
                navigation.navigate("GroupStatistics", { id: groupId })
              }
            />
            <IconButton
              icon="cog-outline"
              onPress={() =>
                navigation.navigate("GroupSettings", { id: groupId })
              }
            />
          </View>
        ),
    });
  }, [
    group,
    groupId,
    navigation,
    openSearch,
    search.active,
    search.close,
    search.input,
    search.setInput,
    t,
  ]);

  async function invite() {
    await runPendingAction("invite", async () => {
      let response: { url: string };
      try {
        response = await api.post<{ url: string }>(
          `/api/groups/${groupId}/invitations/`,
          {},
        );
      } catch (error) {
        showSnackbar(apiWriteErrorMessage(error, t));
        return;
      }
      const result = await shareLink(response.url, {
        title: t("invite.shareTitle"),
      });
      if (result === "copied") {
        showSnackbar(t("invite.copied"), { duration: 8000 });
      } else if (result === "failed") {
        setManualCopyLink(response.url);
      }
    });
  }

  async function settle() {
    if (!settleTarget) return;
    await runPendingAction("settle", async () => {
      try {
        await api.post(`/api/groups/${groupId}/settlements/`, {
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

  function toggleExpanded(participantId: number) {
    setExpandedParticipantIds((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId],
    );
  }

  function avatarForParticipant(participantId: number) {
    return balances.find((row) => row.participant_id === participantId)
      ?.avatar_url;
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
      receiver_avatar_url: avatarForParticipant(detail.to_participant_id),
    });
    setSettleAmount(detail.amount);
    setSettleCurrency(detail.currency);
  }

  async function remindToSettle(row: GroupBalance) {
    // The card-level remind action targets the row owner.  The net amount
    // they owe is stored as a negative number on the row, so we send its
    // absolute value through the API.
    const amount = Math.abs(asNumber(row.amount));
    await runPendingAction(
      `settle-reminder:${row.participant_id}`,
      async () => {
        try {
          const result = await api.post<{ sent: boolean }>(
            `/api/groups/${groupId}/reminders/settle/`,
            {
              participant_id: row.participant_id,
              amount: amount.toFixed(2),
              currency: row.currency,
            },
          );
          showSnackbar(
            result.sent
              ? t("settlement.reminderSent", { person: row.display_name })
              : t("settlement.reminderNoPush", { person: row.display_name }),
          );
        } catch (error) {
          showSnackbar(apiWriteErrorMessage(error, t));
        }
      },
    );
  }

  async function remindToTrackExpenses() {
    await runPendingAction("track-reminder", async () => {
      try {
        const result = await api.post<{ recipients: number; sent: number }>(
          `/api/groups/${groupId}/reminders/track-expense/`,
          {},
        );
        let reminderMessage: string;
        if (result.recipients === 0) {
          reminderMessage = t("invite.trackReminderNobody");
        } else if (result.sent === 0) {
          reminderMessage = t("invite.trackReminderNoPush");
        } else {
          reminderMessage = t("invite.trackReminderSent", {
            count: result.sent,
          });
        }
        showSnackbar(reminderMessage);
      } catch (error) {
        showSnackbar(apiWriteErrorMessage(error, t));
      } finally {
        setTrackReminderConfirmVisible(false);
      }
    });
  }

  const handleScroll = useInfiniteScroll({
    enabled: selectedTab === "expenses",
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
            accessibilityLabel={t("expense.add")}
            onPress={() =>
              navigation.navigate("AddExpense", {
                contextType: "group",
                contextId: groupId,
                resetKey: Date.now(),
                returnToPrevious: true,
              })
            }
          >
            <MaterialCommunityIcons
              name="plus"
              size={18}
              color={theme.colors.onPrimary}
            />
          </Button>
          <Button
            mode="elevated"
            icon="link-variant"
            loading={isPending("invite")}
            disabled={hasPending}
            onPress={() => invite()}
          >
            {t("invite.create")}
          </Button>
          <Button
            mode="elevated"
            icon="bell-outline"
            loading={isPending("track-reminder")}
            disabled={hasPending}
            onPress={() => setTrackReminderConfirmVisible(true)}
          >
            {t("invite.remind")}
          </Button>
        </View>

        <GroupBalanceSummaryCard summary={balanceSummary} />

        <SegmentedButtons
          value={selectedTab}
          onValueChange={setSelectedTab}
          buttons={[
            { value: "expenses", label: t("group.expenses") },
            { value: "balances", label: t("balance.title") },
          ]}
        />

        {selectedTab === "expenses" ? (
          <>
            <View style={styles.inline}>
              <Text variant="titleLarge">{t("group.expenses")}</Text>
              {(ledger.loadingInitial || groupQuery.loading) && (
                <ActivityIndicator size={16} />
              )}
            </View>
            {!search.term && (
              <PendingExpenseList
                mutations={pending.items}
                fallbackCurrency={group?.default_currency}
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
              currentParticipantId={group?.current_participant_id}
              onOpenExpense={(id) =>
                navigation.navigate("ExpenseDetail", { id })
              }
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
          </>
        ) : (
          <>
            <View style={styles.inline}>
              <Text variant="titleLarge">{t("balance.title")}</Text>
              {groupQuery.loading && <ActivityIndicator size={16} />}
            </View>
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
              <Switch
                value={simplifyBalances}
                onValueChange={handleSimplifyToggle}
              />
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
                  actionsDisabled={hasPending}
                  pendingReminderParticipantId={pendingReminderParticipantId}
                />
              ))
            ) : (
              <EmptyState
                image={appImages.emptyExpenses}
                text={t("balance.empty")}
              />
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
          saving={isPending("settle")}
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
            <Button onPress={() => setSimplifyInfoVisible(false)}>
              {t("common.ok")}
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog
          visible={trackReminderConfirmVisible}
          onDismiss={
            hasPending
              ? () => undefined
              : () => setTrackReminderConfirmVisible(false)
          }
        >
          <Dialog.Title>{t("invite.trackReminder")}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t("invite.trackReminderConfirm")}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              disabled={hasPending}
              onPress={() => setTrackReminderConfirmVisible(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              loading={isPending("track-reminder")}
              disabled={hasPending}
              onPress={remindToTrackExpenses}
            >
              {t("invite.remind")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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

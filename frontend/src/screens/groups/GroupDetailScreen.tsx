import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Button, Card, IconButton, List, Portal, SegmentedButtons, Snackbar, Text, TouchableRipple } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { appImages } from "../../shared/assets/images";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { PendingExpenseList } from "../../shared/ledger/PendingExpenseList";
import { pendingExpensesForContext, removePendingExpense, retryPendingExpenses as retryPendingExpenseSync } from "../../shared/ledger/pendingExpenses";
import { SettlementDialog, SettlementDialogTarget } from "../../shared/ledger/SettlementDialog";
import { SettlementLedgerRow } from "../../shared/ledger/SettlementLedgerRow";
import { useInfiniteScroll } from "../../shared/ledger/useInfiniteScroll";
import { shareLink } from "../../shared/lib/shareLink";
import { cachedGet } from "../../shared/lib/offlineCache";
import { asNumber } from "../../shared/lib/money";
import { PendingMutation } from "../../shared/sync/queue";
import { Group, GroupBalance, LedgerItem } from "../../shared/types/models";
import { OverviewStackParamList } from "../../application/navigationTypes";
import { BalanceLine, BalanceSummaryCard } from "../../shared/ui/BalanceSummaryCard";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ExpenseLedgerRow } from "../../shared/ui/ExpenseLedgerRow";
import { ManualCopyDialog } from "../../shared/ui/ManualCopyDialog";
import { ImageViewerModal } from "../../shared/ui/ImageViewerModal";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

type GroupDetailScreenProps = NativeStackScreenProps<OverviewStackParamList, "GroupDetail">;

export function GroupDetailScreen({ route, navigation }: GroupDetailScreenProps) {
  const { t } = useI18n();
  const { api } = useAuth();
  const { showSuccess } = useFeedback();
  const groupId = route.params.id;
  const [group, setGroup] = useState<Group | null>(null);
  const [balances, setBalances] = useState<GroupBalance[]>([]);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<PendingMutation[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedTab, setSelectedTab] = useState("expenses");
  const [expandedParticipantIds, setExpandedParticipantIds] = useState<number[]>([]);
  const [settleTarget, setSettleTarget] = useState<SettlementDialogTarget | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleCurrency, setSettleCurrency] = useState("EUR");
  const [snackbar, setSnackbar] = useState("");
  const [manualCopyLink, setManualCopyLink] = useState("");
  const [groupImageVisible, setGroupImageVisible] = useState(false);
  const balanceSummary = useMemo(
    () => buildBalanceSummary(balances, group?.current_participant_id, group?.default_currency),
    [balances, group?.current_participant_id, group?.default_currency]
  );

  async function load(offset = 0) {
    if (loadingMore && offset) return;
    if (offset) setLoadingMore(true);
    setPendingExpenses(await pendingExpensesForContext("group", groupId));
    try {
      const ledgerPath = `/api/groups/${groupId}/ledger/?offset=${offset}&limit=30`;
      const [detail, balanceRows, ledgerResponse] = await Promise.all([
        cachedGet<Group>(api, `/api/groups/${groupId}/`),
        cachedGet<GroupBalance[]>(api, `/api/groups/${groupId}/balances/`),
        offset
          ? api.get<{ results: LedgerItem[]; next_offset: number | null }>(ledgerPath)
          : cachedGet<{ results: LedgerItem[]; next_offset: number | null }>(api, ledgerPath)
      ]);
      setGroup(detail);
      setBalances(balanceRows);
      setLedger((current) => (offset ? [...current, ...ledgerResponse.results] : ledgerResponse.results));
      setNextOffset(ledgerResponse.next_offset);
    } finally {
      if (offset) setLoadingMore(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [groupId])
  );

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
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
      headerRight: () => (
        <View style={{ flexDirection: "row" }}>
          <IconButton icon="chart-bar" onPress={() => navigation.navigate("GroupStatistics", { id: groupId })} />
          <IconButton icon="cog-outline" onPress={() => navigation.navigate("GroupSettings", { id: groupId })} />
        </View>
      )
    });
  }, [group, groupId, navigation, t]);

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
            icon="plus"
            onPress={() =>
              navigation.navigate("AddExpense", {
                contextType: "group",
                contextId: groupId,
                resetKey: Date.now(),
                returnToPrevious: true
              })
            }
          >
            {t("expense.add")}
          </Button>
          <Button mode="elevated" icon="link-variant" onPress={() => invite()}>
            {t("invite.create")}
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
            {ledger.length ? (
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
              )
            ) : pendingExpenses.length ? null : (
              <EmptyState image={appImages.emptyExpenses} text={t("expense.empty")} />
            )}
            {nextOffset !== null ? (
              <Button mode="text" loading={loadingMore} onPress={() => load(nextOffset)}>
                {t("activity.loadMore")}
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Text variant="titleLarge">{t("balance.title")}</Text>
            {balances.length ? (
              balances.map((row) => {
                const expanded = expandedParticipantIds.includes(row.participant_id);
                return (
                  <Card key={row.participant_id} mode="elevated" style={styles.card}>
                    <TouchableRipple style={styles.clickable} onPress={() => toggleExpanded(row.participant_id)}>
                      <Card.Content style={styles.gap}>
                        <View style={styles.rowBetween}>
                          <PersonAvatar name={row.display_name} imageUrl={row.avatar_url} />
                          <View style={styles.flex}>
                            <Text variant="titleMedium">
                              {t(asNumber(row.amount) >= 0 ? "balance.personIsOwed" : "balance.personOwes", {
                                person: row.display_name,
                                amount: `${Math.abs(asNumber(row.amount)).toFixed(2)} ${row.currency}`
                              })}
                            </Text>
                          </View>
                          <List.Icon icon={expanded ? "chevron-up" : "chevron-down"} />
                        </View>
                        {expanded ? (
                          row.details.length ? (
                            row.details.map((detail) => (
                              <View
                                key={`${detail.from_participant_id}-${detail.to_participant_id}`}
                                style={styles.subtleRow}
                              >
                                <Text variant="bodyMedium">
                                  {t("balance.owesLine", {
                                    from: detail.from_display_name,
                                    to: detail.to_display_name,
                                    amount: `${detail.amount} ${detail.currency}`
                                  })}
                                </Text>
                                <Button
                                  mode="elevated"
                                  icon="cash-check"
                                  compact
                                  onPress={() => {
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
                                  }}
                                >
                                  {t("settlement.settle")}
                                </Button>
                              </View>
                            ))
                          ) : (
                            <Text variant="bodyMedium">{t("balance.empty")}</Text>
                          )
                        ) : null}
                      </Card.Content>
                    </TouchableRipple>
                  </Card>
                );
              })
            ) : (
              <EmptyState image={appImages.emptyExpenses} text={t("balance.empty")} />
            )}
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

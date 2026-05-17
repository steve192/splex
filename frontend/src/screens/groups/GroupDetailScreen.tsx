import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Card, Dialog, IconButton, List, Portal, SegmentedButtons, Snackbar, Text, TextInput, TouchableRipple } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { asNumber, balanceText } from "../../shared/lib/money";
import { PendingMutation, syncPendingMutations } from "../../shared/sync/queue";
import { Group, GroupBalance, LedgerItem } from "../../shared/types/models";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ExpenseLedgerRow } from "../../shared/ui/ExpenseLedgerRow";
import { MoneyText } from "../../shared/ui/MoneyText";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

export function GroupDetailScreen({ route, navigation }: any) {
  const { t } = useI18n();
  const { api } = useAuth();
  const groupId = route.params.id;
  const [group, setGroup] = useState<Group | null>(null);
  const [balances, setBalances] = useState<GroupBalance[]>([]);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<PendingMutation[]>([]);
  const [selectedTab, setSelectedTab] = useState("expenses");
  const [expandedParticipantIds, setExpandedParticipantIds] = useState<number[]>([]);
  const [settleTarget, setSettleTarget] = useState<any | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [snackbar, setSnackbar] = useState("");

  async function load() {
    const [detail, balanceRows, ledgerRows] = await Promise.all([
      api.get<Group>(`/api/groups/${groupId}/`),
      api.get<GroupBalance[]>(`/api/groups/${groupId}/balances/`),
      api.get<LedgerItem[]>(`/api/groups/${groupId}/ledger/`)
    ]);
    setGroup(detail);
    setBalances(balanceRows);
    setLedger(ledgerRows);
    const pendingRows = await syncPendingMutations.list();
    setPendingExpenses(
      pendingRows.filter((mutation) => {
        const payload = mutation.payload as any;
        return payload?.context_type === "group" && payload?.context_id === groupId;
      })
    );
  }

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => load().catch(() => undefined));
    return unsubscribe;
  }, [navigation, groupId]);

  async function invite() {
    const body = {};
    const response = await api.post<{ url: string }>(`/api/groups/${groupId}/invitations/`, body);
    setSnackbar(response.url);
  }

  async function settle() {
    if (!settleTarget) return;
    await api.post(`/api/groups/${groupId}/settlements/`, {
      payer_participant_id: settleTarget.payer_participant_id,
      receiver_participant_id: settleTarget.receiver_participant_id,
      amount: settleAmount
    });
    setSettleTarget(null);
    setSettleAmount("");
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

  function toggleExpanded(participantId: number) {
    setExpandedParticipantIds((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId]
    );
  }

  return (
    <View style={styles.flex}>
      <Screen>
        <View style={styles.rowBetween}>
          <View style={styles.inline}>
            <PersonAvatar name={group?.name ?? t("group.title")} imageUrl={group?.icon_url} size={44} />
            <Text variant="headlineSmall">{group?.name ?? t("group.title")}</Text>
          </View>
          <IconButton icon="cog-outline" onPress={() => navigation.navigate("GroupSettings", { id: groupId })} />
        </View>
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
                            <Text>{`${expense.amount ?? ""} ${expense.currency ?? group?.default_currency ?? ""}`}</Text>
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
            {ledger.length ? (
              ledger.map((item) =>
                item.type === "expense" ? (
                  <ExpenseLedgerRow
                    key={`expense-${item.expense.id}`}
                    expense={item.expense}
                    currentParticipantId={group?.current_participant_id}
                    t={t}
                    onPress={() => navigation.navigate("ExpenseDetail", { id: item.expense.id })}
                  />
                ) : (
                  <Card key={`settlement-${item.settlement.id}`} mode="elevated" style={styles.card}>
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
              )
            ) : pendingExpenses.length ? null : (
              <EmptyState text={t("expense.empty")} />
            )}
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
                              {asNumber(row.amount) >= 0
                                ? t("balance.personOwesYou")
                                    .replace("{person}", row.display_name)
                                    .replace("{amount}", `${Math.abs(asNumber(row.amount)).toFixed(2)} ${row.currency}`)
                                : t("balance.youOwePerson")
                                    .replace("{person}", row.display_name)
                                    .replace("{amount}", `${Math.abs(asNumber(row.amount)).toFixed(2)} ${row.currency}`)}
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
                                  {t("balance.owesLine")
                                    .replace("{from}", detail.from_display_name)
                                    .replace("{to}", detail.to_display_name)
                                    .replace("{amount}", `${detail.amount} ${detail.currency}`)}
                                </Text>
                                <Button
                                  mode="elevated"
                                  compact
                                  onPress={() => {
                                    setSettleTarget({
                                      display_name: `${detail.from_display_name} -> ${detail.to_display_name}`,
                                      amount: detail.amount,
                                      currency: detail.currency,
                                      payer_participant_id: detail.from_participant_id,
                                      receiver_participant_id: detail.to_participant_id
                                    });
                                    setSettleAmount(detail.amount);
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
              <EmptyState text={t("balance.empty")} />
            )}
          </>
        )}

      </Screen>

      <Portal>
        <Dialog visible={!!settleTarget} onDismiss={() => setSettleTarget(null)}>
          <Dialog.Title>{t("settlement.title")}</Dialog.Title>
          <Dialog.Content>
            <Text>{settleTarget ? `${settleTarget.display_name} - ${balanceText(t, settleTarget.amount, settleTarget.currency)}` : ""}</Text>
            <TextInput
              mode="outlined"
              label={t("expense.amount")}
              keyboardType="decimal-pad"
              value={settleAmount}
              onChangeText={setSettleAmount}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSettleTarget(null)}>{t("common.cancel")}</Button>
            <Button disabled={!settleAmount} onPress={settle}>{t("settlement.save")}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar("")} duration={8000}>
        {snackbar}
      </Snackbar>
    </View>
  );
}

import { ReactNode, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  Checkbox,
  Divider,
  HelperText,
  List,
  Modal,
  Portal,
  Searchbar,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  TouchableRipple,
  useTheme
} from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { ApiError } from "../../shared/api/client";
import { useI18n } from "../../shared/i18n/I18nContext";
import { asNumber, buildParticipantsForFriend, createClientId, formatMoney, moneyValue } from "../../shared/lib/money";
import { syncPendingMutations } from "../../shared/sync/queue";
import { ContextOption, ContextType, Expense, Friend, Group, Participant, SplitMethod } from "../../shared/types/models";
import { DatePickerSheet } from "../../shared/ui/DatePickerSheet";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { SelectionOption, SelectionSheet } from "../../shared/ui/SelectionSheet";
import { styles } from "../../shared/ui/styles";

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "PLN", "CZK", "DKK", "SEK", "NOK"];

type ActiveSheet = "currency" | "date" | "payer" | "split" | null;
type AddStep = "context" | "details";

const TOLERANCE = 0.005;

function splitEvenly(total: number, ids: number[]): Record<number, number> {
  const result: Record<number, number> = {};
  if (!ids.length) return result;
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / ids.length);
  let remainder = cents - base * ids.length;
  ids.forEach((id) => {
    const add = remainder > 0 ? 1 : 0;
    remainder -= add;
    result[id] = (base + add) / 100;
  });
  return result;
}

function currencyAmount(value: number, currency: string): string {
  return `${formatMoney(value)} ${currency}`;
}

export function AddScreen({ route, navigation }: any) {
  const { t } = useI18n();
  const { api } = useAuth();
  const theme = useTheme();
  const expenseId = route?.params?.expenseId as number | undefined;
  const pendingMutationId = route?.params?.pendingMutationId as string | undefined;
  const editing = Boolean(expenseId || pendingMutationId);

  const [step, setStep] = useState<AddStep>(route?.params?.contextId || expenseId ? "details" : "context");
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [contextQuery, setContextQuery] = useState("");
  const [contextType, setContextType] = useState<ContextType>(route?.params?.contextType ?? "group");
  const [contextId, setContextId] = useState<number | null>(route?.params?.contextId ?? null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentParticipantId, setCurrentParticipantId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [date, setDate] = useState("");
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("equal_all");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<number[]>([]);
  const [payerId, setPayerId] = useState<number | null>(null);
  const [multiPayer, setMultiPayer] = useState(false);
  const [splitValues, setSplitValues] = useState<Record<number, string>>({});
  const [paymentValues, setPaymentValues] = useState<Record<number, string>>({});
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadedExpense, setLoadedExpense] = useState<Expense | null>(null);

  function resetForm(params = route?.params ?? {}) {
    const nextContextType = params.contextType ?? "group";
    const nextContextId = params.contextId ?? null;
    setStep(nextContextId || params.expenseId ? "details" : "context");
    setContextType(nextContextType);
    setContextId(nextContextId);
    setParticipants([]);
    setCurrentParticipantId(null);
    setDescription("");
    setAmount("");
    setCurrency("EUR");
    setDate("");
    setSplitMethod("equal_all");
    setSelectedParticipantIds([]);
    setPayerId(null);
    setMultiPayer(false);
    setSplitValues({});
    setPaymentValues({});
    setActiveSheet(null);
    setMessage("");
    setLoadedExpense(null);
  }

  const contextOptions = useMemo<ContextOption[]>(
    () => [
      ...groups.map((group) => ({
        type: "group" as const,
        id: group.id,
        name: group.name,
        currency: group.default_currency,
        image_url: group.icon_url
      })),
      ...friends.map((friend) => ({
        type: "friendship" as const,
        id: friend.id,
        name: friend.display_name,
        currency: friend.currency,
        image_url: friend.avatar_url
      }))
    ],
    [groups, friends]
  );

  const selectedContext = contextOptions.find(
    (option) => option.type === contextType && option.id === contextId
  );
  const canRevealOptions = description.trim().length > 0 && amount.trim().length > 0;
  const selectedAllParticipants = selectedParticipantIds.length === participants.length;
  const totalAmount = asNumber(amount);
  const tabValue = splitMethod === "equal_all" || splitMethod === "equal_selected" ? "equal" : splitMethod;

  const filteredGroups = filterByQuery(groups, contextQuery, (group) => group.name);
  const filteredFriends = filterByQuery(friends, contextQuery, (friend) => friend.display_name);

  const selectedEqualShares = useMemo(
    () => splitEvenly(totalAmount, selectedParticipantIds),
    [totalAmount, selectedParticipantIds]
  );

  const exactLeft = useMemo(() => {
    const distributed = selectedParticipantIds.reduce((sum, id) => sum + asNumber(splitValues[id]), 0);
    return totalAmount - distributed;
  }, [selectedParticipantIds, splitValues, totalAmount]);

  const percentageLeft = useMemo(() => {
    const used = selectedParticipantIds.reduce((sum, id) => sum + asNumber(splitValues[id]), 0);
    return 100 - used;
  }, [selectedParticipantIds, splitValues]);

  const adjustmentSum = useMemo(
    () => selectedParticipantIds.reduce((sum, id) => sum + asNumber(splitValues[id]), 0),
    [selectedParticipantIds, splitValues]
  );

  const paymentLeft = useMemo(() => {
    if (!multiPayer) return 0;
    const distributed = participants.reduce((sum, participant) => sum + asNumber(paymentValues[participant.id]), 0);
    return totalAmount - distributed;
  }, [multiPayer, participants, paymentValues, totalAmount]);

  const splitConfigInvalid = useMemo(() => {
    if (!selectedParticipantIds.length) return true;
    if (tabValue === "equal") return false;
    if (tabValue === "exact") return Math.abs(exactLeft) > TOLERANCE;
    if (tabValue === "percentage") return Math.abs(percentageLeft) > TOLERANCE;
    return Math.abs(adjustmentSum) > TOLERANCE;
  }, [adjustmentSum, exactLeft, percentageLeft, selectedParticipantIds.length, tabValue]);

  const paymentConfigInvalid = multiPayer ? Math.abs(paymentLeft) > TOLERANCE : false;

  useEffect(() => {
    resetForm(route?.params ?? {});
  }, [route?.params?.resetKey]);

  useEffect(() => {
    Promise.all([api.get<Group[]>("/api/groups/"), api.get<Friend[]>("/api/friends/")])
      .then(([groupRows, friendRows]) => {
        setGroups(groupRows);
        setFriends(friendRows);
      })
      .catch(() => setMessage(t("common.error")));
  }, [api, t]);

  useEffect(() => {
    if (!expenseId) return;
    api.get<Expense>(`/api/expenses/${expenseId}/`)
      .then((expense) => {
        setLoadedExpense(expense);
        setDescription(expense.description);
        setAmount(expense.original_amount);
        setCurrency(expense.original_currency);
        setDate(expense.date);
        setSplitMethod(expense.split_method);
        setContextType(expense.group_id ? "group" : "friendship");
        setContextId(expense.group_id ?? expense.friendship_id ?? null);
        setStep("details");
        if (expense.payments.length > 1) {
          setMultiPayer(true);
          setPaymentValues(
            Object.fromEntries(expense.payments.map((share) => [share.participant_id, share.amount]))
          );
        } else {
          setMultiPayer(false);
          setPayerId(expense.payments[0]?.participant_id ?? null);
        }
      })
      .catch(() => setMessage(t("common.error")));
  }, [api, expenseId, t]);

  useEffect(() => {
    if (!pendingMutationId) return;
    syncPendingMutations.get(pendingMutationId)
      .then((mutation) => {
        if (!mutation) {
          setMessage(t("common.error"));
          return;
        }
        const payload = mutation.payload as {
          context_type: ContextType;
          context_id: number;
          expense: {
            client_id?: string;
            description: string;
            amount: string;
            currency: string;
            date?: string;
            split_method?: SplitMethod;
            split_payload?: Record<string, any>;
            payments?: Array<{ participant_id: number; amount: string }>;
          };
        };
        const expense = payload.expense;
        setContextType(payload.context_type);
        setContextId(payload.context_id);
        setStep("details");
        setDescription(expense.description);
        setAmount(expense.amount);
        setCurrency(expense.currency);
        setDate(expense.date ?? "");
        setSplitMethod(expense.split_method ?? "equal_all");
        const participantIds = ((expense.split_payload?.participant_ids as number[] | undefined) ?? []).filter(Boolean);
        if (participantIds.length) setSelectedParticipantIds(participantIds);
        if (expense.split_method === "exact") {
          const shares = (expense.split_payload?.shares as any[] | undefined) ?? [];
          setSplitValues(Object.fromEntries(shares.map((share) => [share.participant_id, String(share.amount)])));
          setSelectedParticipantIds(shares.map((share) => share.participant_id));
        } else if (expense.split_method === "percentage") {
          const shares = (expense.split_payload?.shares as any[] | undefined) ?? [];
          setSplitValues(Object.fromEntries(shares.map((share) => [share.participant_id, String(share.percentage)])));
          setSelectedParticipantIds(shares.map((share) => share.participant_id));
        } else if (expense.split_method === "adjusted_equal") {
          const adjustments = (expense.split_payload?.adjustments as any[] | undefined) ?? [];
          setSplitValues(Object.fromEntries(adjustments.map((share) => [share.participant_id, String(share.amount)])));
        }
        if ((expense.payments ?? []).length > 1) {
          setMultiPayer(true);
          setPaymentValues(Object.fromEntries((expense.payments ?? []).map((share) => [share.participant_id, share.amount])));
        } else {
          setMultiPayer(false);
          setPayerId(expense.payments?.[0]?.participant_id ?? null);
        }
      })
      .catch(() => setMessage(t("common.error")));
  }, [pendingMutationId, t]);

  useEffect(() => {
    if (!contextId) return;
    async function loadContext() {
      if (contextType === "group") {
        const group = await api.get<Group>(`/api/groups/${contextId}/`);
        const rows = group.participants ?? [];
        setParticipants(rows);
        setCurrentParticipantId(group.current_participant_id ?? null);
        setPayerId((current) => current ?? group.current_participant_id ?? rows[0]?.id ?? null);
        if (!loadedExpense && !pendingMutationId) setCurrency(group.default_currency);
        if (!loadedExpense && !pendingMutationId && group.default_split_method) setSplitMethod(group.default_split_method);
        if (!loadedExpense && !pendingMutationId) setSelectedParticipantIds(rows.map((participant) => participant.id));
      } else {
        const friend = await api.get<Friend>(`/api/friends/${contextId}/`);
        const rows = buildParticipantsForFriend(friend);
        setParticipants(rows);
        setCurrentParticipantId(friend.current_participant_id ?? null);
        setPayerId((current) => current ?? friend.current_participant_id ?? rows[0]?.id ?? null);
        if (!loadedExpense && !pendingMutationId) setCurrency(friend.currency);
        if (!loadedExpense && !pendingMutationId) setSelectedParticipantIds(rows.map((participant) => participant.id));
      }
      if (!loadedExpense && !pendingMutationId) {
        setSplitValues({});
        setPaymentValues({});
      }
    }
    loadContext().catch(() => setMessage(t("common.error")));
  }, [api, contextId, contextType, loadedExpense, pendingMutationId, t]);

  useEffect(() => {
    if (!loadedExpense || !participants.length) return;
    setSelectedParticipantIds(loadedExpense.owed.map((share) => share.participant_id));
    if (loadedExpense.split_method === "exact") {
      setSplitValues(
        Object.fromEntries(loadedExpense.owed.map((share) => [share.participant_id, share.amount]))
      );
    } else if (loadedExpense.split_method === "percentage") {
      const shares = (loadedExpense.split_payload?.shares as any[] | undefined) ?? [];
      setSplitValues(
        Object.fromEntries(shares.map((share) => [share.participant_id, String(share.percentage)]))
      );
    } else if (loadedExpense.split_method === "adjusted_equal") {
      const adjustments = (loadedExpense.split_payload?.adjustments as any[] | undefined) ?? [];
      setSplitValues(
        Object.fromEntries(adjustments.map((share) => [share.participant_id, String(share.amount)]))
      );
    } else {
      setSplitValues({});
    }
  }, [loadedExpense, participants]);

  useEffect(() => {
    if (!pendingMutationId || !participants.length || selectedParticipantIds.length) return;
    setSelectedParticipantIds(participants.map((participant) => participant.id));
  }, [participants, pendingMutationId, selectedParticipantIds.length]);

  function participantName(participant: Participant): string {
    return participant.id === currentParticipantId ? t("common.you") : participant.display_name;
  }

  function selectContext(option: ContextOption) {
    setContextType(option.type);
    setContextId(option.id);
    setCurrency(option.currency);
    setStep("details");
  }

  function toggleParticipant(participantId: number) {
    setSelectedParticipantIds((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId]
    );
  }

  function setSplitValue(participantId: number, value: string) {
    setSplitValues((current) => ({ ...current, [participantId]: value }));
  }

  function setPaymentValue(participantId: number, value: string) {
    setPaymentValues((current) => ({ ...current, [participantId]: value }));
  }

  function effectiveSplitMethod(): SplitMethod {
    if (splitMethod === "equal_all" || splitMethod === "equal_selected") {
      return selectedAllParticipants ? "equal_all" : "equal_selected";
    }
    return splitMethod;
  }

  function perMemberShare(participantId: number): number {
    if (tabValue === "equal") {
      return selectedEqualShares[participantId] ?? 0;
    }
    if (tabValue === "exact") {
      return selectedParticipantIds.includes(participantId) ? asNumber(splitValues[participantId]) : 0;
    }
    if (tabValue === "percentage") {
      const percentage = selectedParticipantIds.includes(participantId) ? asNumber(splitValues[participantId]) : 0;
      return totalAmount * percentage / 100;
    }
    if (!selectedParticipantIds.includes(participantId)) return 0;
    const base = selectedEqualShares[participantId] ?? 0;
    return base + asNumber(splitValues[participantId]);
  }

  function buildSplitPayload() {
    const method = effectiveSplitMethod();
    if (method === "equal_all") return undefined;
    if (method === "equal_selected") {
      return { participant_ids: selectedParticipantIds };
    }
    if (method === "exact") {
      return {
        shares: selectedParticipantIds.map((participantId) => ({
          participant_id: participantId,
          amount: moneyValue(splitValues[participantId] ?? "0")
        }))
      };
    }
    if (method === "percentage") {
      return {
        shares: selectedParticipantIds.map((participantId) => ({
          participant_id: participantId,
          percentage: moneyValue(splitValues[participantId] ?? "0")
        }))
      };
    }
    return {
      participant_ids: selectedParticipantIds,
      adjustments: selectedParticipantIds
        .filter((participantId) => splitValues[participantId])
        .map((participantId) => ({
          participant_id: participantId,
          amount: moneyValue(splitValues[participantId])
        }))
    };
  }

  function buildPayments() {
    if (multiPayer) {
      return participants
        .filter((participant) => paymentValues[participant.id])
        .map((participant) => ({
          participant_id: participant.id,
          amount: moneyValue(paymentValues[participant.id])
        }));
    }
    return payerId
      ? [
          {
            participant_id: payerId,
            amount: moneyValue(amount)
          }
        ]
      : undefined;
  }

  async function save() {
    if (!contextId) return;
    if (splitConfigInvalid || paymentConfigInvalid) return;
    setSaving(true);
    const expense = {
      client_id: pendingMutationId ?? createClientId(),
      description: description.trim(),
      amount: moneyValue(amount),
      currency: currency.toUpperCase(),
      date: date || undefined,
      split_method: effectiveSplitMethod(),
      split_payload: buildSplitPayload(),
      payments: buildPayments()
    };
    const payload = { context_type: contextType, context_id: contextId, expense };
    try {
      const path =
        contextType === "group"
          ? `/api/groups/${contextId}/expenses/`
          : `/api/friends/${contextId}/expenses/`;
      if (expenseId) {
        await api.patch(`/api/expenses/${expenseId}/`, expense);
      } else if (pendingMutationId) {
        await syncPendingMutations.enqueue({
          id: pendingMutationId,
          type: "create_expense",
          payload,
          createdAt: new Date().toISOString(),
          status: "pending"
        });
      } else {
        await api.post(path, expense);
      }
      setMessage(t("expense.saved"));
      navigation.setParams?.({ expenseId: undefined, contextType: undefined, contextId: undefined });
      navigateAfterSave();
      if (!expenseId) {
        setDescription("");
        setAmount("");
        setDate("");
        setSplitValues({});
        setPaymentValues({});
      }
    } catch (error) {
      if (error instanceof ApiError && error.offline) {
        await syncPendingMutations.enqueue({
          id: expense.client_id,
          type: "create_expense",
          payload,
          createdAt: new Date().toISOString(),
          status: "pending"
        });
        setMessage(t("expense.queued"));
      } else {
        setMessage(t("expense.saveFailed"));
      }
    } finally {
      setSaving(false);
    }
  }

  async function deletePendingExpense() {
    if (!pendingMutationId) return;
    await syncPendingMutations.remove(pendingMutationId);
    navigateAfterSave();
  }

  function navigateAfterSave() {
    if (route?.params?.returnToPrevious && navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    if (contextType === "group" && contextId) {
      navigation.getParent?.()?.navigate("Overview", {
        screen: "GroupDetail",
        params: { id: contextId }
      });
      return;
    }
    if (contextType === "friendship" && contextId) {
      navigation.getParent?.()?.navigate("Overview", {
        screen: "FriendDetail",
        params: { id: contextId }
      });
      return;
    }
    navigation.getParent?.()?.navigate("Overview");
  }

  const hasPayment = multiPayer
    ? Object.values(paymentValues).some((value) => Boolean(value))
    : Boolean(payerId);

  const valid =
    !!selectedContext &&
    !!description &&
    !!amount &&
    hasPayment &&
    selectedParticipantIds.length > 0 &&
    !splitConfigInvalid &&
    !paymentConfigInvalid;

  const currencyOptions: SelectionOption<string>[] = CURRENCIES.map((code) => ({ value: code, label: code }));

  if (step === "context" && !editing) {
    return (
      <Screen>
        <Text variant="headlineSmall">{t("expense.add")}</Text>
        <Searchbar
          value={contextQuery}
          onChangeText={setContextQuery}
          placeholder={t("expense.searchContext")}
        />
        <ContextSection title={t("overview.groups")} emptyText={t("overview.noGroups")}>
          {filteredGroups.map((group) => (
            <ContextRow
              key={group.id}
              title={group.name}
              description={group.default_currency}
              imageUrl={group.icon_url}
              onPress={() =>
                selectContext({
                  type: "group",
                  id: group.id,
                  name: group.name,
                  currency: group.default_currency,
                  image_url: group.icon_url
                })
              }
            />
          ))}
        </ContextSection>
        <ContextSection title={t("overview.friends")} emptyText={t("overview.noFriends")}>
          {filteredFriends.map((friend) => (
            <ContextRow
              key={friend.id}
              title={friend.display_name}
              description={friend.currency}
              imageUrl={friend.avatar_url}
              onPress={() =>
                selectContext({
                  type: "friendship",
                  id: friend.id,
                  name: friend.display_name,
                  currency: friend.currency,
                  image_url: friend.avatar_url
                })
              }
            />
          ))}
        </ContextSection>
        {!groups.length && !friends.length ? <HelperText type="info">{t("expense.noContexts")}</HelperText> : null}
      </Screen>
    );
  }

  return (
    <View style={styles.flex}>
      <Screen>
        <View style={styles.rowBetween}>
          <View style={[styles.flex, styles.inline]}>
            {selectedContext ? <PersonAvatar name={selectedContext.name} imageUrl={selectedContext.image_url} /> : null}
            <View>
              <Text variant="headlineSmall">{editing ? t("expense.edit") : t("expense.add")}</Text>
              {selectedContext ? <Text variant="bodyMedium">{selectedContext.name}</Text> : null}
            </View>
          </View>
          {!editing ? (
            <Button mode="text" icon="swap-horizontal" onPress={() => setStep("context")}>
              {t("expense.changeContext")}
            </Button>
          ) : (
            <Button mode="text" onPress={navigateAfterSave}>
              {t("common.cancel")}
            </Button>
          )}
        </View>

        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <TextInput
              mode="outlined"
              label={t("expense.description")}
              value={description}
              onChangeText={setDescription}
              autoFocus={!description}
            />
            <View style={styles.formRow}>
              <TextInput
                mode="outlined"
                style={styles.flex}
                label={t("expense.amount")}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />
              <Button mode="elevated" onPress={() => setActiveSheet("currency")} style={{ alignSelf: "center" }}>
                {currency}
              </Button>
            </View>
          </Card.Content>
        </Card>

        {canRevealOptions ? (
          <>
            <Card mode="elevated" style={styles.card}>
              <Card.Content style={styles.gap}>
                <TouchableRipple onPress={() => setActiveSheet("date")}>
                  <View style={styles.rowBetween}>
                    <Text variant="titleMedium">{t("expense.date")}</Text>
                    <Text variant="bodyMedium">{date || t("common.today")}</Text>
                  </View>
                </TouchableRipple>
                <Divider />
                <TouchableRipple onPress={() => setActiveSheet("payer")}>
                  <View style={styles.rowBetween}>
                    <Text variant="titleMedium">{t("expense.paidBy")}</Text>
                    <Text variant="bodyMedium">{paymentSummary()}</Text>
                  </View>
                </TouchableRipple>
                <Divider />
                <TouchableRipple onPress={() => setActiveSheet("split")}>
                  <View style={styles.rowBetween}>
                    <Text variant="titleMedium">{t("expense.split")}</Text>
                    <Text variant="bodyMedium">{splitSummary()}</Text>
                  </View>
                </TouchableRipple>
              </Card.Content>
            </Card>

            <Button mode="contained" icon="check" loading={saving} disabled={!valid || saving} onPress={save}>
              {t("expense.save")}
            </Button>
            {pendingMutationId ? (
              <Button mode="text" icon="delete-outline" textColor="#B3261E" onPress={deletePendingExpense}>
                {t("expense.deletePending")}
              </Button>
            ) : null}
          </>
        ) : (
          <HelperText type="info">{t("expense.fastEntryHint")}</HelperText>
        )}
        {message ? <Text style={{ color: theme.colors.secondary }}>{message}</Text> : null}
      </Screen>

      <SelectionSheet
        visible={activeSheet === "currency"}
        title={t("expense.currency")}
        options={currencyOptions}
        value={currency}
        searchable
        onSelect={setCurrency}
        onDismiss={() => setActiveSheet(null)}
      />
      <DatePickerSheet
        visible={activeSheet === "date"}
        value={date}
        title={t("expense.date")}
        onSelect={setDate}
        onDismiss={() => setActiveSheet(null)}
      />
      {renderPayerSheet()}
      {renderSplitSheet()}
    </View>
  );

  function paymentSummary(): string {
    if (multiPayer) {
      const names = participants
        .filter((participant) => paymentValues[participant.id])
        .map((participant) => participantName(participant));
      return names.length ? names.join(", ") : t("expense.multiplePayers");
    }
    return payerId
      ? participantName(participants.find((participant) => participant.id === payerId) ?? {
          id: payerId,
          display_name: t("expense.paidBy"),
          kind: "",
          user_id: null
        })
      : t("expense.paidBy");
  }

  function splitSummary(): string {
    if (tabValue === "equal") {
      return t("split.selectedCountEqual").replace("{count}", String(selectedParticipantIds.length));
    }
    return `${t(`split.${splitMethod}`)} (${selectedParticipantIds.length})`;
  }

  function renderPayerSheet() {
    return (
      <Portal>
        <Modal
          visible={activeSheet === "payer"}
          onDismiss={() => setActiveSheet(null)}
          contentContainerStyle={[styles.bottomSheet, { backgroundColor: theme.colors.surface }]}
          style={styles.bottomSheetWrapper}
        >
          <View style={[styles.bottomSheetHandle, { backgroundColor: theme.colors.outlineVariant }]} />
          <View style={styles.rowBetween}>
            <Text variant="titleLarge">{t("expense.paidBy")}</Text>
            <Button disabled={paymentConfigInvalid} onPress={() => setActiveSheet(null)}>
              {t("common.done")}
            </Button>
          </View>
          <View style={styles.rowBetween}>
            <Text variant="bodyMedium">{t("expense.multiplePayers")}</Text>
            <Switch value={multiPayer} onValueChange={setMultiPayer} />
          </View>
          {!multiPayer ? (
            participants.map((participant) => (
              <List.Item
                key={participant.id}
                style={styles.listTile}
                title={participantName(participant)}
                description={currencyAmount(totalAmount, currency)}
                onPress={() => setPayerId(participant.id)}
                left={() => <PersonAvatar name={participantName(participant)} imageUrl={participant.avatar_url} />}
                right={(props) => (
                  <List.Icon {...props} icon={payerId === participant.id ? "radiobox-marked" : "radiobox-blank"} />
                )}
              />
            ))
          ) : (
            <View style={styles.gap}>
              <Text variant="bodyMedium" style={paymentConfigInvalid ? styles.splitHelperError : undefined}>
                {t("expense.amountLeft").replace("{amount}", currencyAmount(paymentLeft, currency))}
              </Text>
              {participants.map((participant) => (
                <List.Item
                  key={participant.id}
                  style={styles.listTile}
                  title={participantName(participant)}
                  description={t("expense.memberPays").replace("{amount}", currencyAmount(asNumber(paymentValues[participant.id]), currency))}
                  left={() => <PersonAvatar name={participantName(participant)} imageUrl={participant.avatar_url} />}
                  right={() => (
                    <TextInput
                      mode="outlined"
                      dense
                      style={styles.splitRowInput}
                      keyboardType="decimal-pad"
                      value={paymentValues[participant.id] ?? ""}
                      onChangeText={(value) => setPaymentValue(participant.id, value)}
                    />
                  )}
                />
              ))}
            </View>
          )}
        </Modal>
      </Portal>
    );
  }

  function renderSplitSheet() {
    return (
      <Portal>
        <Modal
          visible={activeSheet === "split"}
          onDismiss={() => setActiveSheet(null)}
          contentContainerStyle={[styles.bottomSheet, { backgroundColor: theme.colors.surface }]}
          style={styles.bottomSheetWrapper}
        >
          <View style={[styles.bottomSheetHandle, { backgroundColor: theme.colors.outlineVariant }]} />
          <View style={styles.rowBetween}>
            <Text variant="titleLarge">{t("expense.split")}</Text>
            <Button disabled={splitConfigInvalid} onPress={() => setActiveSheet(null)}>
              {t("common.done")}
            </Button>
          </View>
          <SegmentedButtons
            value={tabValue}
            onValueChange={(value) => {
              const method = value === "equal" ? "equal_all" : (value as SplitMethod);
              setSplitMethod(method);
              if (!selectedParticipantIds.length) {
                setSelectedParticipantIds(participants.map((participant) => participant.id));
              }
            }}
            buttons={[
              { value: "equal", label: t("split.shortEqual") },
              { value: "exact", label: t("split.shortExact") },
              { value: "percentage", label: t("split.shortPercentage") },
              { value: "adjusted_equal", label: t("split.shortAdjusted") }
            ]}
          />
          <SplitStatus />
          <View style={styles.gap}>
            {participants.map((participant) => renderSplitMemberRow(participant))}
          </View>
        </Modal>
      </Portal>
    );
  }

  function SplitStatus() {
    if (tabValue === "equal") return null;
    if (tabValue === "exact") {
      return (
        <Text variant="bodyMedium" style={Math.abs(exactLeft) > TOLERANCE ? styles.splitHelperError : undefined}>
          {t("expense.amountLeft").replace("{amount}", currencyAmount(exactLeft, currency))}
        </Text>
      );
    }
    if (tabValue === "percentage") {
      return (
        <Text variant="bodyMedium" style={Math.abs(percentageLeft) > TOLERANCE ? styles.splitHelperError : undefined}>
          {t("expense.percentageLeft").replace("{amount}", `${formatMoney(percentageLeft)}%`)}
        </Text>
      );
    }
    if (Math.abs(adjustmentSum) <= TOLERANCE) return null;
    if (Math.abs(adjustmentSum) > totalAmount + TOLERANCE) {
      return <Text style={styles.splitHelperError}>{t("expense.adjustmentOverTotal")}</Text>;
    }
    return (
      <Text style={styles.splitHelperError}>
        {t("expense.adjustmentMustZero").replace("{amount}", currencyAmount(adjustmentSum, currency))}
      </Text>
    );
  }

  function renderSplitMemberRow(participant: Participant) {
    const selected = selectedParticipantIds.includes(participant.id);
    const memberShare = perMemberShare(participant.id);
    const showInput = tabValue !== "equal";
    const suffix = tabValue === "percentage" ? "%" : currency;

    return (
      <List.Item
        key={participant.id}
        style={styles.listTile}
        title={participantName(participant)}
        description={t("expense.memberPays").replace("{amount}", currencyAmount(memberShare, currency))}
        onPress={tabValue === "equal" ? () => toggleParticipant(participant.id) : undefined}
        left={() => (
          <View style={styles.inline}>
            <Checkbox.Android
              status={selected ? "checked" : "unchecked"}
              onPress={() => toggleParticipant(participant.id)}
            />
            <PersonAvatar name={participantName(participant)} imageUrl={participant.avatar_url} />
          </View>
        )}
        right={() =>
          showInput ? (
            <TextInput
              mode="outlined"
              dense
              style={styles.splitRowInput}
              keyboardType="decimal-pad"
              value={splitValues[participant.id] ?? ""}
              disabled={!selected}
              onChangeText={(value) => setSplitValue(participant.id, value)}
              right={<TextInput.Affix text={suffix} />}
            />
          ) : null
        }
      />
    );
  }
}

function filterByQuery<T>(items: T[], query: string, label: (item: T) => string): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => label(item).toLowerCase().includes(normalized));
}

function ContextSection({
  title,
  emptyText,
  children
}: {
  title: string;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.gap}>
      <Text variant="titleLarge">{title}</Text>
      {Array.isArray(children) && children.length === 0 ? <Text variant="bodyMedium">{emptyText}</Text> : children}
    </View>
  );
}

function ContextRow({
  title,
  description,
  imageUrl,
  onPress
}: {
  title: string;
  description: string;
  imageUrl?: string;
  onPress: () => void;
}) {
  return (
    <Card mode="elevated" style={styles.card}>
      <TouchableRipple style={styles.clickable} onPress={onPress}>
        <Card.Content>
          <List.Item
            style={styles.listTile}
            title={title}
            description={description}
            left={() => <PersonAvatar name={title} imageUrl={imageUrl} />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
          />
        </Card.Content>
      </TouchableRipple>
    </Card>
  );
}

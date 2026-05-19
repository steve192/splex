import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  Divider,
  HelperText,
  Text,
  TextInput,
  TouchableRipple,
  useTheme
} from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { ActivityStackParamList, AddStackParamList, OverviewStackParamList } from "../../application/navigationTypes";
import { ApiError } from "../../shared/api/client";
import { defaultGroupAvatar } from "../../shared/assets/images";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { CURRENCIES } from "../../shared/lib/currencies";
import {
  loadCachedFriend,
  loadCachedFriends,
  loadCachedGroup,
  loadCachedGroups,
  saveCachedFriend,
  saveCachedFriends,
  saveCachedGroup,
  saveCachedGroups
} from "../../shared/lib/offlineCache";
import { asNumber, buildParticipantsForFriend, createClientId, formatMoney, moneyValue } from "../../shared/lib/money";
import { syncPendingMutations } from "../../shared/sync/queue";
import { ContextOption, ContextType, Expense, Friend, Group, Participant, SplitMethod } from "../../shared/types/models";
import { DatePickerSheet } from "../../shared/ui/DatePickerSheet";
import { negativeColor } from "../../shared/ui/colors";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { SelectionOption, SelectionSheet } from "../../shared/ui/SelectionSheet";
import { styles } from "../../shared/ui/styles";
import { ContextPickerSheet } from "./ContextPickerSheet";
import {
  buildPayments,
  buildSplitPayload,
  currencyAmount,
  effectiveSplitMethod,
  perMemberShare,
  splitEvenly,
  splitTabValue,
  SPLIT_TOLERANCE
} from "./expenseFormLogic";
import { PayerSheet } from "./PayerSheet";
import { SplitSheet } from "./SplitSheet";

type ActiveSheet = "context" | "currency" | "date" | "payer" | "split" | null;

type AddScreenProps =
  | NativeStackScreenProps<OverviewStackParamList, "AddExpense">
  | NativeStackScreenProps<ActivityStackParamList, "AddExpense">
  | NativeStackScreenProps<AddStackParamList, "AddHome">;

export function AddScreen({ route, navigation }: AddScreenProps) {
  const { t } = useI18n();
  const { api } = useAuth();
  const { showSuccess } = useFeedback();
  const theme = useTheme();
  const dangerColor = negativeColor(theme);
  const expenseId = route?.params?.expenseId as number | undefined;
  const pendingMutationId = route?.params?.pendingMutationId as string | undefined;
  const editing = Boolean(expenseId || pendingMutationId);

  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
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
  const tabValue = splitTabValue(splitMethod);

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
    if (tabValue === "exact") return Math.abs(exactLeft) > SPLIT_TOLERANCE;
    if (tabValue === "percentage") return Math.abs(percentageLeft) > SPLIT_TOLERANCE;
    return Math.abs(adjustmentSum) > SPLIT_TOLERANCE;
  }, [adjustmentSum, exactLeft, percentageLeft, selectedParticipantIds.length, tabValue]);

  const paymentConfigInvalid = multiPayer ? Math.abs(paymentLeft) > SPLIT_TOLERANCE : false;

  useEffect(() => {
    resetForm(route?.params ?? {});
  }, [route?.params?.resetKey]);

  const loadContexts = useCallback(async () => {
    try {
      const [groupRows, friendRows] = await Promise.all([api.get<Group[]>("/api/groups/"), api.get<Friend[]>("/api/friends/")]);
      setGroups(groupRows);
      setFriends(friendRows);
      setMessage("");
      await Promise.all([saveCachedGroups(groupRows), saveCachedFriends(friendRows)]);
    } catch {
      const [cachedGroups, cachedFriends] = await Promise.all([loadCachedGroups(), loadCachedFriends()]);
      if (cachedGroups.length || cachedFriends.length) {
        setGroups(cachedGroups);
        setFriends(cachedFriends);
        return;
      }
      setMessage(t("common.error"));
    }
  }, [api, t]);

  useFocusEffect(
    useCallback(() => {
      loadContexts().catch(() => undefined);
    }, [loadContexts])
  );

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
      const activeContextId = contextId;
      if (activeContextId == null) return;

      if (contextType === "group") {
        let group: Group;
        try {
          group = await api.get<Group>(`/api/groups/${activeContextId}/`);
          await saveCachedGroup(group);
        } catch {
          const cachedGroup = await loadCachedGroup(activeContextId);
          if (!cachedGroup) throw new Error("missing cached group");
          group = cachedGroup;
        }
        const rows = group.participants ?? [];
        setParticipants(rows);
        setCurrentParticipantId(group.current_participant_id ?? null);
        setPayerId((current) => current ?? group.current_participant_id ?? rows[0]?.id ?? null);
        if (!loadedExpense && !pendingMutationId) setCurrency(group.default_currency);
        if (!loadedExpense && !pendingMutationId && group.default_split_method) setSplitMethod(group.default_split_method);
        if (!loadedExpense && !pendingMutationId) setSelectedParticipantIds(rows.map((participant) => participant.id));
      } else {
        let friend: Friend;
        try {
          friend = await api.get<Friend>(`/api/friends/${activeContextId}/`);
          await saveCachedFriend(friend);
        } catch {
          const cachedFriend = await loadCachedFriend(activeContextId);
          if (!cachedFriend) throw new Error("missing cached friend");
          friend = cachedFriend;
        }
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
      split_method: effectiveSplitMethod(splitMethod, selectedAllParticipants),
      split_payload: buildSplitPayload({
        method: effectiveSplitMethod(splitMethod, selectedAllParticipants),
        selectedParticipantIds,
        splitValues
      }),
      payments: buildPayments({ multiPayer, participants, paymentValues, payerId, amount })
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
      showSuccess({ icon: "check" });
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
        showSuccess({ icon: "cloud-check-outline" });
        navigateAfterSave();
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

  return (
    <View style={styles.flex}>
      <Screen>
        <View style={styles.rowBetween}>
          <View style={[styles.flex, styles.inline]}>
            {selectedContext ? (
              <PersonAvatar
                name={selectedContext.name}
                imageUrl={selectedContext.image_url}
                imageSource={
                  selectedContext.type === "group" ? defaultGroupAvatar(selectedContext.name) : undefined
                }
              />
            ) : null}
            <View>
              <Text variant="headlineSmall">{editing ? t("expense.edit") : t("expense.add")}</Text>
              {selectedContext ? <Text variant="bodyMedium">{selectedContext.name}</Text> : null}
            </View>
          </View>
          {editing ? (
            <Button mode="text" onPress={navigateAfterSave}>
              {t("common.cancel")}
            </Button>
          ) : selectedContext ? (
            <Button mode="text" icon="swap-horizontal" onPress={() => setActiveSheet("context")}>
              {t("expense.changeContext")}
            </Button>
          ) : null}
        </View>

        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <View style={styles.formRow}>
              <TextInput
                mode="outlined"
                style={styles.flex}
                label={t("expense.amount")}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                autoFocus={!amount}
              />
              <Button mode="elevated" onPress={() => setActiveSheet("currency")} style={{ alignSelf: "center" }}>
                {currency}
              </Button>
            </View>
            <TextInput
              mode="outlined"
              label={t("expense.description")}
              value={description}
              onChangeText={setDescription}
            />
          </Card.Content>
        </Card>

        {canRevealOptions ? (
          <>
            <Card mode="elevated" style={styles.card}>
              <Card.Content style={styles.gap}>
                <TouchableRipple onPress={() => setActiveSheet("context")}>
                  <View style={styles.rowBetween}>
                    <Text variant="titleMedium">{t("expense.contextLabel")}</Text>
                    <Text variant="bodyMedium">{selectedContext?.name ?? t("expense.contextChoose")}</Text>
                  </View>
                </TouchableRipple>
                {selectedContext ? (
                  <>
                    <Divider />
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
                  </>
                ) : null}
              </Card.Content>
            </Card>

            <Button mode="contained" icon="check" loading={saving} disabled={!valid || saving} onPress={save}>
              {t("expense.save")}
            </Button>
            {pendingMutationId ? (
              <Button mode="text" icon="delete-outline" textColor={dangerColor} onPress={deletePendingExpense}>
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
      <PayerSheet
        visible={activeSheet === "payer"}
        participants={participants}
        multiPayer={multiPayer}
        payerId={payerId}
        paymentValues={paymentValues}
        paymentLeft={paymentLeft}
        paymentConfigInvalid={paymentConfigInvalid}
        totalAmount={totalAmount}
        currency={currency}
        surfaceColor={theme.colors.surface}
        handleColor={theme.colors.outlineVariant}
        t={t}
        participantName={participantName}
        currencyAmount={currencyAmount}
        asNumber={asNumber}
        onDismiss={() => setActiveSheet(null)}
        onMultiPayerChange={setMultiPayer}
        onPayerChange={setPayerId}
        onPaymentValueChange={setPaymentValue}
      />
      <SplitSheet
        visible={activeSheet === "split"}
        participants={participants}
        selectedParticipantIds={selectedParticipantIds}
        splitValues={splitValues}
        tabValue={tabValue}
        splitConfigInvalid={splitConfigInvalid}
        exactLeft={exactLeft}
        percentageLeft={percentageLeft}
        adjustmentSum={adjustmentSum}
        totalAmount={totalAmount}
        currency={currency}
        surfaceColor={theme.colors.surface}
        handleColor={theme.colors.outlineVariant}
        t={t}
        participantName={participantName}
        currencyAmount={currencyAmount}
        formatMoney={formatMoney}
        perMemberShare={(participantId) =>
          perMemberShare({
            participantId,
            tabValue,
            selectedParticipantIds,
            selectedEqualShares,
            splitValues,
            totalAmount
          })
        }
        onDismiss={() => setActiveSheet(null)}
        onSplitMethodChange={setSplitMethod}
        onEnsureParticipants={() => {
          if (!selectedParticipantIds.length) {
            setSelectedParticipantIds(participants.map((participant) => participant.id));
          }
        }}
        onToggleParticipant={toggleParticipant}
        onSplitValueChange={setSplitValue}
      />
      <ContextPickerSheet
        visible={activeSheet === "context"}
        groups={groups}
        friends={friends}
        onSelect={selectContext}
        onDismiss={() => setActiveSheet(null)}
      />
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

}

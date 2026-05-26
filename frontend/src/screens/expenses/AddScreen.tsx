import { useNetInfo } from "@react-native-community/netinfo";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Divider,
  HelperText,
  IconButton,
  Text,
  TextInput,
  TouchableRipple,
  useTheme
} from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { ActivityStackParamList, AddStackParamList, OverviewStackParamList } from "../../application/navigationTypes";
import { ApiError } from "../../shared/api/client";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { CURRENCIES } from "../../shared/lib/currencies";
import { useLocationForm } from "../../shared/location/useLocationForm";
import { cachedGet } from "../../shared/lib/offlineCache";
import { asNumber, buildParticipantsForFriend, createClientId, moneyValue } from "../../shared/lib/money";
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
  applyPaymentsToForm,
  buildPayments,
  buildSplitPayload,
  effectiveSplitMethod,
  hydrateSplit,
  perMemberShare,
  splitEvenly,
  splitTabValue,
  SPLIT_TOLERANCE
} from "./expenseFormLogic";
import { PayerSheet } from "./PayerSheet";
import { SplitSheet } from "./SplitSheet";
import { LocationSuggestionsInput } from "../../shared/ui/LocationSuggestionsInput";
import { ReceiptList } from "../../shared/receipts/ReceiptList";
import { pickReceipt, uploadReceipt } from "../../shared/receipts/receiptService";
import type { Receipt } from "../../shared/types/models";

type ActiveSheet = "context" | "currency" | "date" | "payer" | "split" | null;

type AddScreenProps =
  | NativeStackScreenProps<OverviewStackParamList, "AddExpense">
  | NativeStackScreenProps<ActivityStackParamList, "AddExpense">
  | NativeStackScreenProps<AddStackParamList, "AddHome">;

export function AddScreen({ route, navigation }: AddScreenProps) {
  const { t } = useI18n();
  const { api, user } = useAuth();
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
  // client_id is generated once and stays stable for the lifetime of the form.
  // It links any draft receipts the user uploads before save to the eventual
  // expense (see uploadReceipt + backend attach_drafts_to_expense).
  const [draftClientId] = useState(() => pendingMutationId ?? createClientId());
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Receipts require a live network connection: a draft upload talks to the
  // backend immediately, and a pending-sync mutation has no server-side expense
  // yet to attach against.
  const netInfo = useNetInfo();
  const isOnline = netInfo.isConnected !== false && netInfo.isInternetReachable !== false;
  const canUploadReceipts = isOnline && !pendingMutationId;

  const locationForm = useLocationForm(user?.location_tracking_enabled ?? false);

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
    () => {
      const options = [
        ...groups.map((group) => ({
          type: "group" as const,
          id: group.id,
          name: group.name,
          currency: group.default_currency,
          image_url: group.icon_url,
          last_expense_date: group.last_expense_date
        })),
        ...friends.map((friend) => ({
          type: "friendship" as const,
          id: friend.id,
          name: friend.display_name,
          currency: friend.default_currency,
          image_url: friend.avatar_url,
          last_expense_date: friend.last_expense_date
        }))
      ];

      // Sort by recently used (most recent expense first), then by name for those without expenses
      return options.sort((a, b) => {
        const aDate = a.last_expense_date ? new Date(a.last_expense_date).getTime() : 0;
        const bDate = b.last_expense_date ? new Date(b.last_expense_date).getTime() : 0;
        if (aDate !== bDate) return bDate - aDate;
        return a.name.localeCompare(b.name);
      });
    },
    [groups, friends]
  );

  const selectedContext = contextOptions.find(
    (option) => option.type === contextType && option.id === contextId
  );
  const canRevealOptions = description.trim().length > 0 && amount.trim().length > 0;
  const selectedAllParticipants =
    participants.length > 0 &&
    selectedParticipantIds.length === participants.length &&
    participants.every((participant) => selectedParticipantIds.includes(participant.id));
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

  const adjustedHasNegativeShare = useMemo(() => {
    if (tabValue !== "adjusted_equal") return false;
    return selectedParticipantIds.some(
      (id) =>
        perMemberShare({
          participantId: id,
          tabValue,
          selectedParticipantIds,
          selectedEqualShares,
          splitValues,
          totalAmount
        }) < -SPLIT_TOLERANCE
    );
  }, [selectedEqualShares, selectedParticipantIds, splitValues, tabValue, totalAmount]);

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
    return adjustedHasNegativeShare;
  }, [adjustedHasNegativeShare, exactLeft, percentageLeft, selectedParticipantIds.length, tabValue]);

  const paymentConfigInvalid = multiPayer ? Math.abs(paymentLeft) > SPLIT_TOLERANCE : false;

  useEffect(() => {
    resetForm(route?.params ?? {});
  }, [route?.params?.resetKey]);

  const loadContexts = useCallback(async () => {
    try {
      const [groupRows, friendRows] = await Promise.all([
        cachedGet<Group[]>(api, "/api/groups/"),
        cachedGet<Friend[]>(api, "/api/friends/")
      ]);
      setGroups(groupRows);
      setFriends(friendRows);
      setMessage("");
    } catch {
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
        applyPaymentsToForm(expense.payments, { setMultiPayer, setPaymentValues, setPayerId });
        setReceipts(expense.receipts ?? []);
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
        const splitMethodFromPayload = expense.split_method ?? "equal_all";
        setSplitMethod(splitMethodFromPayload);
        const hydrated = hydrateSplit(splitMethodFromPayload, expense.split_payload);
        if (hydrated.selectedParticipantIds) setSelectedParticipantIds(hydrated.selectedParticipantIds);
        if (hydrated.splitValues) setSplitValues(hydrated.splitValues);
        applyPaymentsToForm(expense.payments, { setMultiPayer, setPaymentValues, setPayerId });
      })
      .catch(() => setMessage(t("common.error")));
  }, [pendingMutationId, t]);

  useEffect(() => {
    if (!contextId) return;
    async function loadContext() {
      const activeContextId = contextId;
      if (activeContextId == null) return;

      if (contextType === "group") {
        const group = await cachedGet<Group>(api, `/api/groups/${activeContextId}/`);
        const rows = group.participants ?? [];
        setParticipants(rows);
        setCurrentParticipantId(group.current_participant_id ?? null);
        setPayerId((current) => current ?? group.current_participant_id ?? rows[0]?.id ?? null);
        if (!loadedExpense && !pendingMutationId) setCurrency(group.default_currency);
        if (!loadedExpense && !pendingMutationId && group.default_split_method) setSplitMethod(group.default_split_method);
        if (!loadedExpense && !pendingMutationId) setSelectedParticipantIds(rows.map((participant) => participant.id));
      } else {
        const friend = await cachedGet<Friend>(api, `/api/friends/${activeContextId}/`);
        const rows = buildParticipantsForFriend(friend);
        setParticipants(rows);
        setCurrentParticipantId(friend.current_participant_id ?? null);
        setPayerId((current) => current ?? friend.current_participant_id ?? rows[0]?.id ?? null);
        if (!loadedExpense && !pendingMutationId) setCurrency(friend.default_currency);
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
    // For "exact", the rendered amounts live on owed shares, not in split_payload.
    const payloadForHydrate =
      loadedExpense.split_method === "exact"
        ? { shares: loadedExpense.owed }
        : loadedExpense.split_payload;
    const hydrated = hydrateSplit(loadedExpense.split_method, payloadForHydrate);
    setSplitValues(hydrated.splitValues ?? {});
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

  async function handleAddReceipt() {
    if (uploadingReceipt) return;
    const asset = await pickReceipt();
    if (!asset) return;
    if (!expenseId && !contextId) {
      setMessage(t("expense.contextChoose"));
      return;
    }
    setUploadingReceipt(true);
    try {
      const ctx = expenseId
        ? { expenseId }
        : {
            clientId: draftClientId,
            groupId: contextType === "group" ? contextId ?? undefined : undefined,
            friendshipId: contextType === "friendship" ? contextId ?? undefined : undefined,
          };
      const uploaded = await uploadReceipt(api, asset, ctx);
      setReceipts((current) => [...current, uploaded]);
    } catch (error) {
      Alert.alert(error instanceof Error ? error.message : t("receipts.uploadFailed"));
    } finally {
      setUploadingReceipt(false);
    }
  }

  function handleReceiptRemoved(receiptId: number) {
    setReceipts((current) => current.filter((r) => r.id !== receiptId));
  }

  async function save() {
    if (!contextId) return;
    if (splitConfigInvalid || paymentConfigInvalid) return;
    setSaving(true);
    const expense = {
      client_id: draftClientId,
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
      payments: buildPayments({ multiPayer, participants, paymentValues, payerId, amount }),
      ...(locationForm.latitude && locationForm.longitude ? {
        latitude: Math.round(locationForm.latitude * 1000000) / 1000000,
        longitude: Math.round(locationForm.longitude * 1000000) / 1000000
      } : {})
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
      } else if (error instanceof ApiError && error.data) {
        // Extract field-specific validation errors
        const fieldErrors = Object.entries(error.data)
          .filter(([, value]) => Array.isArray(value))
          .map(([field, messages]) => `${field}: ${(messages as string[]).join(", ")}`)
          .join(" | ");
        setMessage(fieldErrors || t("expense.saveFailed"));
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
              <PersonAvatar name={selectedContext.name} imageUrl={selectedContext.image_url} />
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
                onChangeText={(text) => {
                  // Allow only digits and decimal separators (. or ,)
                  const filtered = text.replace(/[^0-9.,]/g, "");
                  // Normalize: replace , with . and remove extra decimal separators
                  const normalized = filtered.replace(/,/g, ".");
                  const parts = normalized.split(".");
                  const valid = parts.length <= 2 ? normalized : parts[0] + "." + parts.slice(1).join("");
                  setAmount(valid);
                }}
                autoFocus={!amount && activeSheet === null}
              />
              <Button mode="elevated" onPress={() => setActiveSheet("currency")} style={styles.selfCenter}>
                {currency}
              </Button>
            </View>
            <LocationSuggestionsInput
              value={description}
              onChangeText={setDescription}
              suggestions={locationForm.suggestions}
              loading={locationForm.loadingSuggestions}
              label={t("expense.description")}
              maxLength={240}
            />
          </Card.Content>
        </Card>

        {canRevealOptions ? (
          <>
            <Card mode="elevated" style={styles.card}>
              <Card.Content style={styles.optionRowCard}>
                <TouchableRipple style={styles.optionRow} onPress={() => setActiveSheet("context")}>
                  <View style={styles.rowBetween}>
                    <Text variant="titleMedium">{t("expense.contextLabel")}</Text>
                    <Text variant="bodyMedium">{selectedContext?.name ?? t("expense.contextChoose")}</Text>
                  </View>
                </TouchableRipple>
                {selectedContext ? (
                  <>
                    <Divider />
                    <TouchableRipple style={styles.optionRow} onPress={() => setActiveSheet("date")}>
                      <View style={styles.rowBetween}>
                        <Text variant="titleMedium">{t("expense.date")}</Text>
                        <Text variant="bodyMedium">{date || t("common.today")}</Text>
                      </View>
                    </TouchableRipple>
                    <Divider />
                    <TouchableRipple style={styles.optionRow} onPress={() => setActiveSheet("payer")}>
                      <View style={styles.rowBetween}>
                        <Text variant="titleMedium">{t("expense.paidBy")}</Text>
                        <Text variant="bodyMedium">{paymentSummary()}</Text>
                      </View>
                    </TouchableRipple>
                    <Divider />
                    <TouchableRipple style={styles.optionRow} onPress={() => setActiveSheet("split")}>
                      <View style={styles.rowBetween}>
                        <Text variant="titleMedium">{t("expense.split")}</Text>
                        <Text variant="bodyMedium">{splitSummary()}</Text>
                      </View>
                    </TouchableRipple>
                  </>
                ) : null}
              </Card.Content>
            </Card>

            {selectedContext && (canUploadReceipts || receipts.length > 0) ? (
              <Card mode="elevated" style={styles.card}>
                <Card.Content style={styles.gap}>
                  <View style={styles.rowBetween}>
                    <Text variant="titleMedium">{t("receipts.section")}</Text>
                    {canUploadReceipts ? (
                      uploadingReceipt ? (
                        <ActivityIndicator />
                      ) : (
                        <IconButton
                          icon="paperclip"
                          onPress={handleAddReceipt}
                          accessibilityLabel={t("receipts.addAction")}
                        />
                      )
                    ) : null}
                  </View>
                  {!canUploadReceipts ? (
                    <HelperText type="info">{t("receipts.offlineHint")}</HelperText>
                  ) : null}
                  <ReceiptList
                    receipts={receipts}
                    allowRemove={canUploadReceipts}
                    onRemoved={handleReceiptRemoved}
                  />
                </Card.Content>
              </Card>
            ) : null}

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
        currentParticipantId={currentParticipantId}
        multiPayer={multiPayer}
        payerId={payerId}
        paymentValues={paymentValues}
        paymentLeft={paymentLeft}
        paymentConfigInvalid={paymentConfigInvalid}
        totalAmount={totalAmount}
        currency={currency}
        onDismiss={() => setActiveSheet(null)}
        onMultiPayerChange={setMultiPayer}
        onPayerChange={setPayerId}
        onPaymentValueChange={setPaymentValue}
      />
      <SplitSheet
        visible={activeSheet === "split"}
        participants={participants}
        currentParticipantId={currentParticipantId}
        selectedParticipantIds={selectedParticipantIds}
        splitValues={splitValues}
        tabValue={tabValue}
        splitConfigInvalid={splitConfigInvalid}
        exactLeft={exactLeft}
        percentageLeft={percentageLeft}
        adjustedHasNegativeShare={adjustedHasNegativeShare}
        currency={currency}
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
        onSplitMethodChange={(method) => {
          if (splitTabValue(method) !== tabValue) setSplitValues({});
          setSplitMethod(method);
        }}
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
    if (!payerId) return t("expense.paidBy");
    const payer = participants.find((participant) => participant.id === payerId);
    return payer ? participantName(payer) : t("expense.paidBy");
  }

  function splitSummary(): string {
    if (tabValue === "equal") {
      return t("split.selectedCountEqual", { count: selectedParticipantIds.length });
    }
    return `${t(`split.${splitMethod}`)} (${selectedParticipantIds.length})`;
  }

}

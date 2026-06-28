import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  Text,
  useTheme,
} from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import {
  ActivityStackParamList,
  AddStackParamList,
  OverviewStackParamList,
} from "../../application/navigationTypes";
import { ApiError } from "../../shared/api/client";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { apiWriteErrorMessage } from "../../shared/lib/apiErrors";
import {
  currencyCodeOrFallback,
  type CurrencyCode,
} from "../../shared/lib/currencies";
import { useLocationForm } from "../../shared/location/useLocationForm";
import { cachedGet } from "../../shared/lib/offlineCache";
import {
  loadRememberContextPreference,
  saveRememberContextPreference,
} from "../../shared/lib/lastContextPreference";
import {
  createClientId,
  moneyValue,
} from "../../shared/lib/money";
import { syncPendingMutations } from "../../shared/sync/queue";
import {
  ContextOption,
  ContextType,
  Expense,
  Friend,
  Group,
  Participant,
  SplitMethod,
} from "../../shared/types/models";
import { negativeColor } from "../../shared/ui/colors";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";
import {
  applyPaymentsToForm,
  buildExpenseLocationPayload,
  buildPayments,
  buildSplitPayload,
  effectiveSplitMethod,
  expenseShareRowsForForm,
  expenseLocationDescriptionKey,
  hydrateSplit,
  normalizeExpenseAmountInput,
  splitPayloadForForm,
} from "./expenseFormLogic";
import { useExpenseValidation } from "./useExpenseValidation";
import { LocationSuggestionsInput } from "../../shared/ui/LocationSuggestionsInput";
import { MoneyAmountInput } from "../../shared/ui/MoneyAmountInput";
import {
  activeExpenseContexts,
  eligibleExpenseMoveGroups,
  hasAlternativeExpenseMoveGroup,
} from "./expenseContexts";
import { expenseEditViewState } from "./expenseLoading";
import { useReceiptUpload } from "./useReceiptUpload";
import { isGroupArchived } from "../groups/groupArchivePolicy";
import {
  EditExpensePlaceholder,
  ExpenseFormHeader,
  ExpenseFormMessages,
  ExpenseRevealSection,
} from "./AddScreenSections";
import { AddScreenSheets } from "./AddScreenSheets";
import {
  activeContextOptions,
  allParticipantsSelected,
  loadedFriendContext,
  loadedGroupContext,
  nextPayerId,
  selectedExpenseContext,
  shouldApplyContextDefaults,
  type LoadedExpenseContext,
} from "./addScreenContextModel";
import {
  pendingExpenseMutation,
  persistExpenseSave,
  shouldQueueOfflineCreate,
  type ExpenseSaveExpense,
  type ExpenseSavePayload,
} from "./addScreenSaveModel";
import type { ActiveSheet } from "./addScreenTypes";

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
  const locationTrackingEnabled = user?.location_tracking_enabled ?? false;
  const expenseId = route?.params?.expenseId;
  const pendingMutationId = route?.params?.pendingMutationId;
  const editingSavedExpense = Boolean(expenseId);
  const editing = Boolean(expenseId || pendingMutationId);
  // "AddHome" is the navigation tab entry point. Opening the screen from a group
  // or friend uses the "AddExpense" route with a pre-populated target instead.
  const calledFromNavigation = route?.name === "AddHome" && !editing;

  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [contextType, setContextType] = useState<ContextType>(
    route?.params?.contextType ?? "group",
  );
  const [contextId, setContextId] = useState<number | null>(
    route?.params?.contextId ?? null,
  );
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentParticipantId, setCurrentParticipantId] = useState<
    number | null
  >(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("EUR");
  const [date, setDate] = useState("");
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("equal_all");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<
    number[]
  >([]);
  const [payerId, setPayerId] = useState<number | null>(null);
  const [multiPayer, setMultiPayer] = useState(false);
  const [splitValues, setSplitValues] = useState<Record<number, string>>({});
  const [paymentValues, setPaymentValues] = useState<Record<number, string>>(
    {},
  );
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [contextArchived, setContextArchived] = useState(false);
  const [archivedContextOption, setArchivedContextOption] =
    useState<ContextOption | null>(null);
  const [loadedExpense, setLoadedExpense] = useState<Expense | null>(null);
  const [moveGroupDetails, setMoveGroupDetails] = useState<Group[]>([]);
  const [contextMoveInfoVisible, setContextMoveInfoVisible] = useState(false);
  const [loadingEditExpense, setLoadingEditExpense] = useState(editing);
  const [editLoadFailed, setEditLoadFailed] = useState(false);
  const [deletingPendingExpense, setDeletingPendingExpense] = useState(false);
  const [includeLocation, setIncludeLocation] = useState(
    locationTrackingEnabled,
  );
  // client_id is generated once and stays stable for the lifetime of the form.
  // It links any draft receipts the user uploads before save to the eventual
  // expense (see uploadReceipt + backend attach_drafts_to_expense).
  const [draftClientId] = useState(() => pendingMutationId ?? createClientId());
  const [rememberContext, setRememberContext] = useState(false);

  const {
    receipts,
    setReceipts,
    uploading: uploadingReceipt,
    canUpload: canUploadReceipts,
    add: handleAddReceipt,
    remove: handleReceiptRemoved,
  } = useReceiptUpload({
    expenseId,
    pendingMutationId,
    contextType,
    contextId,
    draftClientId,
    onMissingContext: () => setMessage(t("expense.contextChoose")),
  });

  const locationForm = useLocationForm(locationTrackingEnabled);

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
    setContextArchived(false);
    setArchivedContextOption(null);
    setLoadedExpense(null);
    setMoveGroupDetails([]);
    setContextMoveInfoVisible(false);
    setLoadingEditExpense(
      Boolean(params.expenseId || params.pendingMutationId),
    );
    setEditLoadFailed(false);
    setIncludeLocation(locationTrackingEnabled);
  }

  const contextOptions = useMemo<ContextOption[]>(
    () => activeContextOptions(groups, friends),
    [groups, friends],
  );

  const eligibleMoveGroups = useMemo(
    () => eligibleExpenseMoveGroups(moveGroupDetails, loadedExpense),
    [loadedExpense, moveGroupDetails],
  );
  const canMoveGroupExpense = hasAlternativeExpenseMoveGroup(
    loadedExpense?.group_id,
    eligibleMoveGroups,
  );
  const contextEditable =
    !editing || (loadedExpense?.group_id != null && canMoveGroupExpense);
  const pickerGroups =
    editing && loadedExpense?.group_id != null ? eligibleMoveGroups : groups;
  const pickerFriends = editing ? [] : friends;

  const selectedContext = selectedExpenseContext({
    options: contextOptions,
    archivedOption: archivedContextOption,
    contextType,
    contextId,
  });
  const canRevealOptions =
    description.trim().length > 0 && amount.trim().length > 0;
  const selectedAllParticipants = allParticipantsSelected(
    participants,
    selectedParticipantIds,
  );
  const {
    totalAmount,
    tabValue,
    selectedEqualShares,
    exactLeft,
    percentageLeft,
    adjustedHasNegativeShare,
    splitConfigInvalid,
    paymentLeft,
    paymentConfigInvalid,
  } = useExpenseValidation({
    amount,
    splitMethod,
    selectedParticipantIds,
    splitValues,
    multiPayer,
    participants,
    paymentValues,
  });

  useEffect(() => {
    resetForm(route?.params ?? {});
  }, [route?.params?.resetKey]);

  useEffect(() => {
    setIncludeLocation(locationTrackingEnabled);
  }, [locationTrackingEnabled, route?.params?.resetKey]);

  // When opened from the navigation tab, restore the "Remember Group / Friend"
  // checkbox and, if it is on, pre-populate the last context the user picked.
  // Re-runs on resetKey so re-tapping the tab re-applies the remembered target.
  useEffect(() => {
    if (!calledFromNavigation) return;
    let cancelled = false;
    loadRememberContextPreference()
      .then((pref) => {
        if (cancelled) return;
        setRememberContext(pref.remember);
        if (pref.remember && pref.context) {
          setContextType(pref.context.type);
          setContextId(pref.context.id);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [calledFromNavigation, route?.params?.resetKey]);

  const loadContexts = useCallback(async () => {
    try {
      const [groupRows, friendRows] = await Promise.all([
        cachedGet<Group[]>(api, "/api/groups/"),
        cachedGet<Friend[]>(api, "/api/friends/"),
      ]);
      const activeContexts = activeExpenseContexts(groupRows, friendRows);
      setGroups(activeContexts.groups);
      setFriends(activeContexts.friends);
      setMessage("");
    } catch {
      setMessage(t("common.error"));
    }
  }, [api, t]);

  useFocusEffect(
    useCallback(() => {
      loadContexts().catch(() => undefined);
    }, [loadContexts]),
  );

  useEffect(() => {
    if (!loadedExpense?.group_id) {
      setMoveGroupDetails([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      groups.map((group) =>
        cachedGet<Group>(api, `/api/groups/${group.id}/`).catch(() => null),
      ),
    )
      .then((rows) => {
        if (cancelled) return;
        setMoveGroupDetails(
          rows.filter((group): group is Group => group !== null),
        );
      })
      .catch(() => {
        if (!cancelled) setMoveGroupDetails([]);
      });
    return () => {
      cancelled = true;
    };
  }, [api, groups, loadedExpense?.group_id]);

  useEffect(() => {
    if (!expenseId) return;
    let cancelled = false;
    setLoadingEditExpense(true);
    setEditLoadFailed(false);
    api
      .get<Expense>(`/api/expenses/${expenseId}/`)
      .then((expense) => {
        if (cancelled) return;
        setLoadedExpense(expense);
        setDescription(expense.description);
        setAmount(expense.original_amount);
        setCurrency(currencyCodeOrFallback(expense.original_currency));
        setDate(expense.date);
        setSplitMethod(expense.split_method);
        setContextType(expense.group_id ? "group" : "friendship");
        setContextId(expense.group_id ?? expense.friendship_id ?? null);
        applyPaymentsToForm(expenseShareRowsForForm(expense.payments, expense), {
          setMultiPayer,
          setPaymentValues,
          setPayerId,
        });
        setReceipts(expense.receipts ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setEditLoadFailed(true);
        setLoadingEditExpense(false);
        setMessage(t("common.error"));
      });
    return () => {
      cancelled = true;
    };
  }, [api, expenseId, setReceipts, t]);

  useEffect(() => {
    if (!pendingMutationId) return;
    let cancelled = false;
    setLoadingEditExpense(true);
    setEditLoadFailed(false);
    syncPendingMutations
      .get(pendingMutationId)
      .then((mutation) => {
        if (cancelled) return;
        if (!mutation) {
          setEditLoadFailed(true);
          setLoadingEditExpense(false);
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
        setCurrency(currencyCodeOrFallback(expense.currency));
        setDate(expense.date ?? "");
        const splitMethodFromPayload = expense.split_method ?? "equal_all";
        setSplitMethod(splitMethodFromPayload);
        const hydrated = hydrateSplit(
          splitMethodFromPayload,
          expense.split_payload,
        );
        if (hydrated.selectedParticipantIds)
          setSelectedParticipantIds(hydrated.selectedParticipantIds);
        if (hydrated.splitValues) setSplitValues(hydrated.splitValues);
        applyPaymentsToForm(expense.payments, {
          setMultiPayer,
          setPaymentValues,
          setPayerId,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setEditLoadFailed(true);
        setLoadingEditExpense(false);
        setMessage(t("common.error"));
      });
    return () => {
      cancelled = true;
    };
  }, [pendingMutationId, t]);

  useEffect(() => {
    if (!contextId) return;
    async function loadContext() {
      const activeContextId = contextId;
      if (activeContextId == null) return;
      const applyDefaults = shouldApplyContextDefaults({
        hasLoadedExpense: Boolean(loadedExpense),
        pendingMutationId,
      });

      if (contextType === "group") {
        const group = await cachedGet<Group>(
          api,
          `/api/groups/${activeContextId}/`,
        );
        const loadedContext = loadedGroupContext(group);
        applyLoadedContext(loadedContext, applyDefaults);
        if (applyDefaults && loadedContext.defaultSplitMethod) {
          setSplitMethod(loadedContext.defaultSplitMethod);
        }
      } else {
        const friend = await cachedGet<Friend>(
          api,
          `/api/friends/${activeContextId}/`,
        );
        applyLoadedContext(loadedFriendContext(friend), applyDefaults);
      }
      if (applyDefaults) {
        setSplitValues({});
        setPaymentValues({});
      }
      if (pendingMutationId) {
        setLoadingEditExpense(false);
        setEditLoadFailed(false);
      }
    }
    loadContext().catch(() => {
      if (editing) {
        setEditLoadFailed(true);
        setLoadingEditExpense(false);
      }
      setMessage(t("common.error"));
    });
  }, [
    api,
    contextId,
    contextType,
    editing,
    loadedExpense,
    pendingMutationId,
    t,
  ]);

  function applyLoadedContext(
    loadedContext: LoadedExpenseContext,
    applyDefaults: boolean,
  ) {
    setContextArchived(loadedContext.archived);
    setArchivedContextOption(loadedContext.archivedContextOption);
    setParticipants(loadedContext.participants);
    setCurrentParticipantId(loadedContext.currentParticipantId);
    setPayerId((current) => nextPayerId(current, loadedContext));
    if (applyDefaults) {
      setCurrency(currencyCodeOrFallback(loadedContext.defaultCurrency));
      setSelectedParticipantIds(
        loadedContext.participants.map((participant) => participant.id),
      );
    }
  }

  useEffect(() => {
    if (!loadedExpense || !participants.length) return;
    setSelectedParticipantIds(
      loadedExpense.owed.map((share) => share.participant_id),
    );
    const hydrated = hydrateSplit(
      loadedExpense.split_method,
      splitPayloadForForm(loadedExpense),
    );
    setSplitValues(hydrated.splitValues ?? {});
    setLoadingEditExpense(false);
    setEditLoadFailed(false);
  }, [loadedExpense, participants]);

  useEffect(() => {
    if (
      !pendingMutationId ||
      !participants.length ||
      selectedParticipantIds.length
    )
      return;
    setSelectedParticipantIds(
      participants.map((participant) => participant.id),
    );
  }, [participants, pendingMutationId, selectedParticipantIds.length]);

  function participantName(participant: Participant): string {
    return participant.id === currentParticipantId
      ? t("common.you")
      : participant.display_name;
  }

  function selectContext(option: ContextOption) {
    if (editing && loadedExpense?.friendship_id) return;
    if (
      editing &&
      loadedExpense?.group_id &&
      (option.type !== "group" ||
        !eligibleMoveGroups.some((group) => group.id === option.id))
    ) {
      return;
    }
    setContextType(option.type);
    setContextId(option.id);
    setCurrency(currencyCodeOrFallback(option.currency));
    setContextArchived(false);
    setArchivedContextOption(null);
    // Only contexts chosen here (i.e. when opened from navigation) are remembered.
    if (calledFromNavigation && rememberContext) {
      saveRememberContextPreference({
        remember: true,
        context: { type: option.type, id: option.id },
      }).catch(() => undefined);
    }
  }

  function toggleRememberContext() {
    const next = !rememberContext;
    setRememberContext(next);
    // Checking the box captures the current target so it is there next time;
    // unchecking clears any remembered target so there is no pre-population.
    saveRememberContextPreference({
      remember: next,
      context:
        next && contextId != null ? { type: contextType, id: contextId } : null,
    }).catch(() => undefined);
  }

  function toggleParticipant(participantId: number) {
    setSelectedParticipantIds((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId],
    );
  }

  function setSplitValue(participantId: number, value: string) {
    setSplitValues((current) => ({ ...current, [participantId]: value }));
  }

  function setPaymentValue(participantId: number, value: string) {
    setPaymentValues((current) => ({ ...current, [participantId]: value }));
  }

  async function save() {
    if (saving) return;
    if (!contextId) return;
    if (contextArchived) {
      setMessage(t("group.archivedReadOnly"));
      return;
    }
    if (splitConfigInvalid || paymentConfigInvalid) return;
    setSaving(true);
    const expense: ExpenseSaveExpense = {
      client_id: draftClientId,
      description: description.trim(),
      amount: moneyValue(amount),
      currency: currency.toUpperCase(),
      date: date || undefined,
      split_method: effectiveSplitMethod(splitMethod, selectedAllParticipants),
      split_payload: buildSplitPayload({
        method: effectiveSplitMethod(splitMethod, selectedAllParticipants),
        selectedParticipantIds,
        splitValues,
      }),
      payments: buildPayments({
        multiPayer,
        participants,
        paymentValues,
        payerId,
        amount,
      }),
      ...buildExpenseLocationPayload({
        latitude: locationForm.latitude,
        longitude: locationForm.longitude,
        editing: editingSavedExpense,
        includeLocation,
        locationTrackingEnabled,
      }),
      ...(expenseId
        ? {
            context_type: contextType,
            context_id: contextId,
          }
        : {}),
    };
    const payload: ExpenseSavePayload = {
      context_type: contextType,
      context_id: contextId,
      expense,
    };
    try {
      await persistExpenseSave({
        api,
        expenseId,
        pendingMutationId,
        contextType,
        contextId,
        expense,
        payload,
        createdAt: new Date().toISOString(),
      });
      setMessage(t("expense.saved"));
      showSuccess({ icon: "check" });
      navigation.setParams?.({
        expenseId: undefined,
        contextType: undefined,
        contextId: undefined,
      });
      navigateAfterSave();
      if (!expenseId) {
        setDescription("");
        setAmount("");
        setDate("");
        setSplitValues({});
        setPaymentValues({});
      }
    } catch (error) {
      if (shouldQueueOfflineCreate(error, expenseId)) {
        await syncPendingMutations.enqueue(
          pendingExpenseMutation({
            id: expense.client_id,
            payload,
            createdAt: new Date().toISOString(),
          }),
        );
        setMessage(t("expense.queued"));
        showSuccess({ icon: "cloud-check-outline" });
        navigateAfterSave();
      } else {
        const errorMessage =
          error instanceof ApiError
            ? apiWriteErrorMessage(error, t)
            : t("expense.saveFailed");
        setMessage(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deletePendingExpense() {
    if (!pendingMutationId || deletingPendingExpense) return;
    setDeletingPendingExpense(true);
    try {
      await syncPendingMutations.remove(pendingMutationId);
      navigateAfterSave();
    } finally {
      setDeletingPendingExpense(false);
    }
  }

  function navigateAfterSave() {
    if (route?.params?.returnToPrevious && navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    if (contextType === "group" && contextId) {
      navigation.getParent?.()?.navigate("Overview", {
        screen: "GroupDetail",
        params: { id: contextId },
      });
      return;
    }
    if (contextType === "friendship" && contextId) {
      navigation.getParent?.()?.navigate("Overview", {
        screen: "FriendDetail",
        params: { id: contextId },
      });
      return;
    }
    navigation.getParent?.()?.navigate("Overview");
  }

  const hasPayment = multiPayer
    ? Object.values(paymentValues).some(Boolean)
    : Boolean(payerId);

  const valid =
    !!selectedContext &&
    !!description &&
    !!amount &&
    hasPayment &&
    selectedParticipantIds.length > 0 &&
    !contextArchived &&
    !splitConfigInvalid &&
    !paymentConfigInvalid;

  const locationDescription = t(
    expenseLocationDescriptionKey({
      editing: editingSavedExpense,
      includeLocation,
    }),
  );
  const editViewState = expenseEditViewState({
    editing,
    loading: loadingEditExpense,
    loadFailed: editLoadFailed,
  });

  if (editViewState !== "content") {
    return (
      <EditExpensePlaceholder
        editing={editing}
        viewState={editViewState}
        onCancel={navigateAfterSave}
      />
    );
  }

  return (
    <View style={styles.flex}>
      <Screen>
        <ExpenseFormHeader
          editing={editing}
          selectedContext={selectedContext}
          contextArchived={contextArchived}
          onCancel={navigateAfterSave}
          onChangeContext={() => setActiveSheet("context")}
        />

        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <View style={styles.formRow}>
              <MoneyAmountInput
                mode="outlined"
                style={styles.flex}
                label={t("expense.amount")}
                value={amount}
                disabled={contextArchived}
                onChangeText={(text) =>
                  setAmount(normalizeExpenseAmountInput(text))
                }
                autoFocus={!amount && activeSheet === null}
              />
              <Button
                mode="elevated"
                disabled={contextArchived}
                onPress={() => setActiveSheet("currency")}
                style={styles.selfCenter}
              >
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
              disabled={contextArchived}
            />
          </Card.Content>
        </Card>

        <ExpenseRevealSection
          canRevealOptions={canRevealOptions}
          selectedContext={selectedContext}
          date={date}
          payerLabel={paymentSummary()}
          splitLabel={splitSummary()}
          contextEditable={contextEditable}
          contextArchived={contextArchived}
          showContextInfo={editing && loadedExpense?.group_id != null}
          locationTrackingEnabled={locationTrackingEnabled}
          locationDescription={locationDescription}
          includeLocation={includeLocation}
          receipts={receipts}
          canUploadReceipts={canUploadReceipts}
          uploadingReceipt={uploadingReceipt}
          saving={saving}
          valid={valid}
          pendingMutationId={pendingMutationId}
          deletingPendingExpense={deletingPendingExpense}
          deleteColor={dangerColor}
          onOpen={setActiveSheet}
          onShowContextInfo={() => setContextMoveInfoVisible(true)}
          onToggleLocation={() => setIncludeLocation((current) => !current)}
          onSetIncludeLocation={setIncludeLocation}
          onAddReceipt={handleAddReceipt}
          onRemoveReceipt={handleReceiptRemoved}
          onSave={save}
          onDeletePendingExpense={deletePendingExpense}
        />
        <ExpenseFormMessages
          contextArchived={contextArchived}
          message={message}
          messageColor={theme.colors.secondary}
        />
      </Screen>

      <AddScreenSheets
        activeSheet={activeSheet}
        contextArchived={contextArchived}
        currency={currency}
        date={date}
        participants={participants}
        currentParticipantId={currentParticipantId}
        multiPayer={multiPayer}
        payerId={payerId}
        paymentValues={paymentValues}
        paymentLeft={paymentLeft}
        paymentConfigInvalid={paymentConfigInvalid}
        totalAmount={totalAmount}
        selectedParticipantIds={selectedParticipantIds}
        selectedEqualShares={selectedEqualShares}
        splitValues={splitValues}
        tabValue={tabValue}
        splitConfigInvalid={splitConfigInvalid}
        exactLeft={exactLeft}
        percentageLeft={percentageLeft}
        adjustedHasNegativeShare={adjustedHasNegativeShare}
        contextEditable={contextEditable}
        pickerGroups={pickerGroups}
        pickerFriends={pickerFriends}
        calledFromNavigation={calledFromNavigation}
        rememberContext={rememberContext}
        contextMoveInfoVisible={contextMoveInfoVisible}
        onActiveSheetChange={setActiveSheet}
        onCurrencyChange={setCurrency}
        onDateChange={setDate}
        onMultiPayerChange={setMultiPayer}
        onPayerChange={setPayerId}
        onPaymentValueChange={setPaymentValue}
        onSplitMethodChange={setSplitMethod}
        onSplitValuesChange={setSplitValues}
        onEnsureParticipants={() => {
          if (!selectedParticipantIds.length) {
            setSelectedParticipantIds(
              participants.map((participant) => participant.id),
            );
          }
        }}
        onToggleParticipant={toggleParticipant}
        onSplitValueChange={setSplitValue}
        onSelectContext={selectContext}
        onToggleRemember={toggleRememberContext}
        onContextMoveInfoVisibleChange={setContextMoveInfoVisible}
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
    const payer = participants.find(
      (participant) => participant.id === payerId,
    );
    return payer ? participantName(payer) : t("expense.paidBy");
  }

  function splitSummary(): string {
    if (tabValue === "equal") {
      return t("split.selectedCountEqual", {
        count: selectedParticipantIds.length,
      });
    }
    const methodLabel = t(`split.${splitMethod}`);
    return `${methodLabel} (${selectedParticipantIds.length})`;
  }
}

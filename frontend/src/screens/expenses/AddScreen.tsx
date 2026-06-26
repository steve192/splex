import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  HelperText,
  List,
  Portal,
  Switch,
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
import { CURRENCIES } from "../../shared/lib/currencies";
import { useLocationForm } from "../../shared/location/useLocationForm";
import { cachedGet } from "../../shared/lib/offlineCache";
import {
  loadRememberContextPreference,
  saveRememberContextPreference,
} from "../../shared/lib/lastContextPreference";
import {
  buildParticipantsForFriend,
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
import { DatePickerSheet } from "../../shared/ui/DatePickerSheet";
import { negativeColor } from "../../shared/ui/colors";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import {
  SelectionOption,
  SelectionSheet,
} from "../../shared/ui/SelectionSheet";
import { styles } from "../../shared/ui/styles";
import { ContextPickerSheet } from "./ContextPickerSheet";
import {
  applyPaymentsToForm,
  buildExpenseLocationPayload,
  buildPayments,
  buildSplitPayload,
  effectiveSplitMethod,
  expenseLocationDescriptionKey,
  hydrateSplit,
  normalizeExpenseAmountInput,
  perMemberShare,
  splitTabValue,
} from "./expenseFormLogic";
import { useExpenseValidation } from "./useExpenseValidation";
import { PayerSheet } from "./PayerSheet";
import { SplitSheet } from "./SplitSheet";
import { LocationSuggestionsInput } from "../../shared/ui/LocationSuggestionsInput";
import { MoneyAmountInput } from "../../shared/ui/MoneyAmountInput";
import { ExpenseOptionsCard } from "./ExpenseOptionsCard";
import {
  activeExpenseContexts,
  eligibleExpenseMoveGroups,
  hasAlternativeExpenseMoveGroup,
} from "./expenseContexts";
import { expenseEditViewState } from "./expenseLoading";
import { ReceiptsCard } from "./ReceiptsCard";
import { useReceiptUpload } from "./useReceiptUpload";
import { isGroupArchived } from "../groups/groupArchivePolicy";

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
  const [currency, setCurrency] = useState("EUR");
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

  const contextOptions = useMemo<ContextOption[]>(() => {
    const options = [
      ...groups.map((group) => ({
        type: "group" as const,
        id: group.id,
        name: group.name,
        currency: group.default_currency,
        image_url: group.icon_url,
        last_expense_date: group.last_expense_date,
      })),
      ...friends.map((friend) => ({
        type: "friendship" as const,
        id: friend.id,
        name: friend.display_name,
        currency: friend.default_currency,
        image_url: friend.avatar_url,
        last_expense_date: friend.last_expense_date,
      })),
    ];

    // Sort by recently used (most recent expense first), then by name for those without expenses
    return options.sort((a, b) => {
      const aDate = a.last_expense_date
        ? new Date(a.last_expense_date).getTime()
        : 0;
      const bDate = b.last_expense_date
        ? new Date(b.last_expense_date).getTime()
        : 0;
      if (aDate !== bDate) return bDate - aDate;
      return a.name.localeCompare(b.name);
    });
  }, [groups, friends]);

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

  const selectedContext =
    contextOptions.find(
      (option) => option.type === contextType && option.id === contextId,
    ) ??
    (archivedContextOption?.type === contextType &&
    archivedContextOption.id === contextId
      ? archivedContextOption
      : undefined);
  const canRevealOptions =
    description.trim().length > 0 && amount.trim().length > 0;
  const selectedAllParticipants =
    participants.length > 0 &&
    selectedParticipantIds.length === participants.length &&
    participants.every((participant) =>
      selectedParticipantIds.includes(participant.id),
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
        setCurrency(expense.original_currency);
        setDate(expense.date);
        setSplitMethod(expense.split_method);
        setContextType(expense.group_id ? "group" : "friendship");
        setContextId(expense.group_id ?? expense.friendship_id ?? null);
        applyPaymentsToForm(expense.payments, {
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
        setCurrency(expense.currency);
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

      if (contextType === "group") {
        const group = await cachedGet<Group>(
          api,
          `/api/groups/${activeContextId}/`,
        );
        const archived = isGroupArchived(group);
        setContextArchived(archived);
        setArchivedContextOption(
          archived
            ? {
                type: "group",
                id: group.id,
                name: group.name,
                currency: group.default_currency,
                image_url: group.icon_url,
                last_expense_date: group.last_expense_date,
              }
            : null,
        );
        const rows = group.participants ?? [];
        setParticipants(rows);
        setCurrentParticipantId(group.current_participant_id ?? null);
        setPayerId(
          (current) =>
            current ?? group.current_participant_id ?? rows[0]?.id ?? null,
        );
        if (!loadedExpense && !pendingMutationId)
          setCurrency(group.default_currency);
        if (!loadedExpense && !pendingMutationId && group.default_split_method)
          setSplitMethod(group.default_split_method);
        if (!loadedExpense && !pendingMutationId)
          setSelectedParticipantIds(rows.map((participant) => participant.id));
      } else {
        setContextArchived(false);
        setArchivedContextOption(null);
        const friend = await cachedGet<Friend>(
          api,
          `/api/friends/${activeContextId}/`,
        );
        const rows = buildParticipantsForFriend(friend);
        setParticipants(rows);
        setCurrentParticipantId(friend.current_participant_id ?? null);
        setPayerId(
          (current) =>
            current ?? friend.current_participant_id ?? rows[0]?.id ?? null,
        );
        if (!loadedExpense && !pendingMutationId)
          setCurrency(friend.default_currency);
        if (!loadedExpense && !pendingMutationId)
          setSelectedParticipantIds(rows.map((participant) => participant.id));
      }
      if (!loadedExpense && !pendingMutationId) {
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

  useEffect(() => {
    if (!loadedExpense || !participants.length) return;
    setSelectedParticipantIds(
      loadedExpense.owed.map((share) => share.participant_id),
    );
    // For "exact", the rendered amounts live on owed shares, not in split_payload.
    const payloadForHydrate =
      loadedExpense.split_method === "exact"
        ? { shares: loadedExpense.owed }
        : loadedExpense.split_payload;
    const hydrated = hydrateSplit(
      loadedExpense.split_method,
      payloadForHydrate,
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
    setCurrency(option.currency);
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
    const payload = {
      context_type: contextType,
      context_id: contextId,
      expense,
    };
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
          status: "pending",
        });
      } else {
        await api.post(path, expense);
      }
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
      if (error instanceof ApiError && error.offline && !expenseId) {
        await syncPendingMutations.enqueue({
          id: expense.client_id,
          type: "create_expense",
          payload,
          createdAt: new Date().toISOString(),
          status: "pending",
        });
        setMessage(t("expense.queued"));
        showSuccess({ icon: "cloud-check-outline" });
        navigateAfterSave();
      } else if (error instanceof ApiError) {
        setMessage(apiWriteErrorMessage(error, t));
      } else {
        setMessage(t("expense.saveFailed"));
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

  const currencyOptions: SelectionOption<string>[] = CURRENCIES.map((code) => ({
    value: code,
    label: code,
  }));
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
      <View style={styles.flex}>
        <Screen>
          <View style={styles.rowBetween}>
            <Text variant="headlineSmall">
              {editing ? t("expense.edit") : t("expense.add")}
            </Text>
            {editing && (
              <Button mode="text" onPress={navigateAfterSave}>
                {t("common.cancel")}
              </Button>
            )}
          </View>
          <View style={styles.emptyStateContent}>
            {editViewState === "loading" ? (
              <ActivityIndicator />
            ) : (
              <Text variant="bodyMedium">{t("common.error")}</Text>
            )}
          </View>
        </Screen>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <Screen>
        <View style={styles.rowBetween}>
          <View style={[styles.flex, styles.inline]}>
            {selectedContext ? (
              <PersonAvatar
                name={selectedContext.name}
                imageUrl={selectedContext.image_url}
              />
            ) : null}
            <View>
              <Text variant="headlineSmall">
                {editing ? t("expense.edit") : t("expense.add")}
              </Text>
              {selectedContext ? (
                <Text variant="bodyMedium">{selectedContext.name}</Text>
              ) : null}
            </View>
          </View>
          {editing && (
            <Button mode="text" onPress={navigateAfterSave}>
              {t("common.cancel")}
            </Button>
          )}
          {!editing && selectedContext && (
            <Button
              mode="text"
              icon="swap-horizontal"
              disabled={contextArchived}
              onPress={() => setActiveSheet("context")}
            >
              {t("expense.changeContext")}
            </Button>
          )}
        </View>

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

        {canRevealOptions ? (
          <>
            <ExpenseOptionsCard
              contextName={selectedContext?.name}
              hasContext={!!selectedContext}
              date={date}
              payerLabel={paymentSummary()}
              splitLabel={splitSummary()}
              onOpen={setActiveSheet}
              contextEditable={contextEditable}
              showContextInfo={editing && loadedExpense?.group_id != null}
              onShowContextInfo={() => setContextMoveInfoVisible(true)}
              disabled={contextArchived}
            />

            {locationTrackingEnabled ? (
              <Card mode="elevated" style={styles.card}>
                <List.Item
                  title={t("expense.location")}
                  description={locationDescription}
                  onPress={() => {
                    if (!contextArchived) {
                      setIncludeLocation((current) => !current);
                    }
                  }}
                  left={(props) => (
                    <List.Icon {...props} icon="map-marker-outline" />
                  )}
                  right={() => (
                    <Switch
                      value={includeLocation}
                      disabled={contextArchived}
                      onValueChange={setIncludeLocation}
                    />
                  )}
                />
              </Card>
            ) : null}

            {selectedContext ? (
              <ReceiptsCard
                receipts={receipts}
                canUpload={canUploadReceipts}
                uploading={uploadingReceipt}
                onAdd={handleAddReceipt}
                onRemove={handleReceiptRemoved}
                disabled={contextArchived}
              />
            ) : null}

            <Button
              mode="contained"
              icon="check"
              loading={saving}
              disabled={!valid || saving || contextArchived}
              onPress={save}
            >
              {t("expense.save")}
            </Button>
            {pendingMutationId ? (
              <Button
                mode="text"
                icon="delete-outline"
                textColor={dangerColor}
                loading={deletingPendingExpense}
                disabled={saving || deletingPendingExpense}
                onPress={deletePendingExpense}
              >
                {t("expense.deletePending")}
              </Button>
            ) : null}
          </>
        ) : (
          <HelperText type="info">{t("expense.fastEntryHint")}</HelperText>
        )}
        {contextArchived ? (
          <HelperText type="info">{t("group.archivedReadOnly")}</HelperText>
        ) : null}
        {message ? (
          <Text style={{ color: theme.colors.secondary }}>{message}</Text>
        ) : null}
      </Screen>

      <SelectionSheet
        visible={activeSheet === "currency" && !contextArchived}
        title={t("expense.currency")}
        options={currencyOptions}
        value={currency}
        searchable
        onSelect={setCurrency}
        onDismiss={() => setActiveSheet(null)}
      />
      <DatePickerSheet
        visible={activeSheet === "date" && !contextArchived}
        value={date}
        title={t("expense.date")}
        onSelect={setDate}
        onDismiss={() => setActiveSheet(null)}
      />
      <PayerSheet
        visible={activeSheet === "payer" && !contextArchived}
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
        visible={activeSheet === "split" && !contextArchived}
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
            totalAmount,
          })
        }
        onDismiss={() => setActiveSheet(null)}
        onSplitMethodChange={(method) => {
          if (splitTabValue(method) !== tabValue) setSplitValues({});
          setSplitMethod(method);
        }}
        onEnsureParticipants={() => {
          if (!selectedParticipantIds.length) {
            setSelectedParticipantIds(
              participants.map((participant) => participant.id),
            );
          }
        }}
        onToggleParticipant={toggleParticipant}
        onSplitValueChange={setSplitValue}
      />
      <ContextPickerSheet
        visible={
          activeSheet === "context" && !contextArchived && contextEditable
        }
        groups={pickerGroups}
        friends={pickerFriends}
        onSelect={selectContext}
        onDismiss={() => setActiveSheet(null)}
        showRemember={calledFromNavigation}
        remember={rememberContext}
        onToggleRemember={toggleRememberContext}
      />
      <Portal>
        <Dialog
          visible={contextMoveInfoVisible}
          onDismiss={() => setContextMoveInfoVisible(false)}
        >
          <Dialog.Title>{t("expense.contextMoveInfoTitle")}</Dialog.Title>
          <Dialog.Content>
            <Text>{t("expense.contextMoveInfoBody")}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setContextMoveInfoVisible(false)}>
              {t("common.ok")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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

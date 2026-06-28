import { RouteProp, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  Divider,
  IconButton,
  List,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import {
  ActivityStackParamList,
  OverviewStackParamList,
} from "../../application/navigationTypes";
import { useI18n } from "../../shared/i18n/I18nContext";
import { useSnackbar } from "../../shared/feedback/SnackbarContext";
import { apiWriteErrorMessage } from "../../shared/lib/apiErrors";
import { formatDeviceDate } from "../../shared/lib/dates";
import { detailActionState } from "../../shared/ledger/detailActionState";
import { usePendingAction } from "../../shared/lib/usePendingAction";
import { Expense, ExpenseShare, Friend, Group } from "../../shared/types/models";
import { LocationMap } from "../../shared/ui/LocationMap";
import { MoneyText } from "../../shared/ui/MoneyText";
import { negativeColor } from "../../shared/ui/colors";
import { ClickableAvatar } from "../../shared/ui/ClickableAvatar";
import { ReceiptList } from "../../shared/receipts/ReceiptList";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";
import { expenseDetailViewState } from "./expenseLoading";
import {
  expenseExchangeRateText,
  expensePersonalNet,
  isConvertedExpense,
} from "./expenseDetailModel";
import { isGroupArchived } from "../groups/groupArchivePolicy";

type ExpenseDetailNavigation = NativeStackNavigationProp<
  OverviewStackParamList & ActivityStackParamList
>;

type ExpenseDetailScreenProps = {
  route: RouteProp<OverviewStackParamList, "ExpenseDetail">;
  navigation: ExpenseDetailNavigation;
};

export function ExpenseDetailScreen({
  route,
  navigation,
}: Readonly<ExpenseDetailScreenProps>) {
  const { t } = useI18n();
  const { api } = useAuth();
  const { showSnackbar } = useSnackbar();
  const { hasPending, isPending, runPendingAction } =
    usePendingAction<"delete">();
  const theme = useTheme();
  const dangerColor = negativeColor(theme);
  const expenseId = route.params.id;
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [currentParticipantId, setCurrentParticipantId] = useState<
    number | null
  >(null);
  const [groupArchived, setGroupArchived] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const actionState = detailActionState({
    archived: groupArchived,
    deleted: Boolean(expense?.deleted_at)
  });
  const personalNet = expense
    ? expensePersonalNet(expense, currentParticipantId)
    : null;

  async function load() {
    setLoading(true);
    setLoadFailed(false);
    try {
      const loaded = await api.get<Expense>(`/api/expenses/${expenseId}/`);
      setExpense(loaded);
      setGroupArchived(false);
      try {
        if (loaded.group_id) {
          const group = await api.get<Group>(`/api/groups/${loaded.group_id}/`);
          setCurrentParticipantId(group.current_participant_id ?? null);
          setGroupArchived(isGroupArchived(group));
        } else if (loaded.friendship_id) {
          const friend = await api.get<Friend>(
            `/api/friends/${loaded.friendship_id}/`,
          );
          setCurrentParticipantId(friend.current_participant_id ?? null);
        }
      } catch {
        // best-effort: personal balance card just won't render
      }
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [expenseId]),
  );

  useEffect(() => {
    navigation.setOptions({
      title: expense?.description ?? t("expense.details"),
      headerRight: () =>
        expense && !expense.deleted_at && !groupArchived ? (
          <IconButton icon="pencil" onPress={editExpense} />
        ) : null,
    });
  }, [expense, groupArchived, navigation, t]);

  async function deleteExpense() {
    if (groupArchived) return;
    await runPendingAction("delete", async () => {
      try {
        await api.delete(`/api/expenses/${expenseId}/`);
      } catch (error) {
        setConfirmDelete(false);
        showSnackbar(apiWriteErrorMessage(error, t));
        return;
      }
      setConfirmDelete(false);
      navigation.goBack();
    });
  }

  function editExpense() {
    if (!expense) return;
    if (groupArchived) return;
    navigation.navigate("AddExpense", {
      expenseId: expense.id,
      contextType: expense.group_id ? "group" : "friendship",
      contextId: expense.group_id ?? expense.friendship_id ?? undefined,
      resetKey: Date.now(),
      returnToPrevious: true,
    });
  }

  const viewState = expenseDetailViewState({
    loading,
    hasExpense: Boolean(expense),
    loadFailed,
  });
  let actionContent = (
    <Button
      mode="elevated"
      icon="delete-outline"
      textColor={dangerColor}
      disabled={hasPending}
      onPress={() => setConfirmDelete(true)}
    >
      {t("expense.delete")}
    </Button>
  );
  if (actionState === "deleted") {
    actionContent = <Text variant="bodyMedium">{t("expense.deleted")}</Text>;
  } else if (actionState === "archived") {
    actionContent = (
      <Text variant="bodyMedium">{t("group.archivedReadOnly")}</Text>
    );
  }

  return (
    <View style={styles.flex}>
      <Screen>
        {viewState === "loading" ? (
          <View style={styles.emptyStateContent}>
            <ActivityIndicator />
          </View>
        ) : null}
        {viewState === "error" ? (
          <View style={styles.emptyStateContent}>
            <Text variant="bodyMedium">{t("common.error")}</Text>
          </View>
        ) : null}
        {viewState === "content" && expense ? (
          <ExpenseDetailContent
            expense={expense}
            personalNet={personalNet}
            actionContent={actionContent}
          />
        ) : null}
      </Screen>

      <Portal>
        <Dialog
          visible={confirmDelete}
          onDismiss={
            hasPending ? () => undefined : () => setConfirmDelete(false)
          }
        >
          <Dialog.Title>{t("expense.delete")}</Dialog.Title>
          <Dialog.Content>
            <Text>{t("expense.deleteConfirm")}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              disabled={hasPending}
              onPress={() => setConfirmDelete(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              loading={isPending("delete")}
              disabled={hasPending}
              onPress={deleteExpense}
            >
              {t("common.delete")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

function ExpenseDetailContent({
  expense,
  personalNet,
  actionContent,
}: Readonly<{
  expense: Expense;
  personalNet: number | null;
  actionContent: ReactNode;
}>) {
  return (
    <>
      <Text variant="bodyMedium">{formatDeviceDate(expense.date)}</Text>
      <ExpenseLocationCard expense={expense} />
      <ExpenseMetrics expense={expense} personalNet={personalNet} />
      <ExpenseSharesCard expense={expense} />
      <ExpenseReceiptsCard expense={expense} />
      {actionContent}
    </>
  );
}

function ExpenseLocationCard({ expense }: Readonly<{ expense: Expense }>) {
  if (!expense.latitude || !expense.longitude) return null;

  return (
    <Card mode="elevated">
      <Card.Content style={styles.gap}>
        <LocationMap
          latitude={expense.latitude}
          longitude={expense.longitude}
          height={200}
        />
      </Card.Content>
    </Card>
  );
}

function ExpenseMetrics({
  expense,
  personalNet,
}: Readonly<{ expense: Expense; personalNet: number | null }>) {
  const { t } = useI18n();
  const exchangeRateText = expenseExchangeRateText(expense);

  return (
    <View style={styles.metricGrid}>
      <Card mode="elevated" style={styles.metricTile}>
        <Card.Content>
          <Text variant="labelLarge">{t("expense.amount")}</Text>
          <MoneyText
            variant="headlineSmall"
            amount={expense.converted_amount}
            currency={expense.converted_currency}
            plain
          />
        </Card.Content>
      </Card>
      {personalNet !== null ? (
        <Card mode="elevated" style={styles.metricTile}>
          <Card.Content>
            <Text variant="labelLarge">{t("expense.yourBalance")}</Text>
            <MoneyText
              variant="headlineSmall"
              amount={personalNet}
              currency={expense.converted_currency}
            />
          </Card.Content>
        </Card>
      ) : null}
      {isConvertedExpense(expense) ? (
        <Card mode="elevated" style={styles.metricTile}>
          <Card.Content>
            <Text variant="labelLarge">{t("expense.originalAmount")}</Text>
            <Text variant="headlineSmall">
              {expense.original_amount} {expense.original_currency}
            </Text>
          </Card.Content>
        </Card>
      ) : null}
      {exchangeRateText ? (
        <Card mode="elevated" style={styles.metricTile}>
          <Card.Content>
            <Text variant="labelLarge">{t("expense.exchangeRate")}</Text>
            <Text variant="titleMedium">{exchangeRateText}</Text>
            {/* This is the provider/snapshot date for the displayed rate, not
                just the purchase date. They differ when the backend falls back. */}
            {expense.exchange_rate_date ? (
              <Text variant="bodySmall">
                {t("expense.exchangeRateDate", {
                  date: formatDeviceDate(expense.exchange_rate_date),
                })}
              </Text>
            ) : null}
          </Card.Content>
        </Card>
      ) : null}
    </View>
  );
}

function ExpenseSharesCard({ expense }: Readonly<{ expense: Expense }>) {
  const { t } = useI18n();

  return (
    <Card mode="elevated">
      <Card.Content style={styles.gap}>
        <Text variant="titleMedium">{t("expense.paidBy")}</Text>
        <ExpenseShareRows
          shares={expense.payments}
          currency={expense.converted_currency}
        />
        <Divider />
        <Text variant="titleMedium">{t("expense.owedBy")}</Text>
        <ExpenseShareRows
          shares={expense.owed}
          currency={expense.converted_currency}
        />
      </Card.Content>
    </Card>
  );
}

function ExpenseShareRows({
  shares,
  currency,
}: Readonly<{ shares: ExpenseShare[]; currency: string }>) {
  return shares.map((share) => (
    <List.Item
      key={share.participant_id}
      title={share.display_name}
      description={`${share.amount} ${currency}`}
      left={() => (
        <ClickableAvatar name={share.display_name} imageUrl={share.avatar_url} />
      )}
    />
  ));
}

function ExpenseReceiptsCard({ expense }: Readonly<{ expense: Expense }>) {
  const { t } = useI18n();
  if (!expense.receipts || expense.receipts.length === 0) return null;

  return (
    <Card mode="elevated">
      <Card.Content style={styles.gap}>
        <Text variant="titleMedium">{t("receipts.section")}</Text>
        <ReceiptList receipts={expense.receipts} />
      </Card.Content>
    </Card>
  );
}

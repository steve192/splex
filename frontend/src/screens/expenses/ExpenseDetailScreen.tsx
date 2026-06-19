import { RouteProp, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { asNumber } from "../../shared/lib/money";
import { detailActionState } from "../../shared/ledger/detailActionState";
import { usePendingAction } from "../../shared/lib/usePendingAction";
import { Expense, Friend, Group } from "../../shared/types/models";
import { LocationMap } from "../../shared/ui/LocationMap";
import { MoneyText } from "../../shared/ui/MoneyText";
import { negativeColor } from "../../shared/ui/colors";
import { ClickableAvatar } from "../../shared/ui/ClickableAvatar";
import { ReceiptList } from "../../shared/receipts/ReceiptList";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";
import { expenseDetailViewState } from "./expenseLoading";
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
  const converted = expense
    ? expense.original_currency !== expense.converted_currency ||
      expense.original_amount !== expense.converted_amount
    : false;
  const personalNet = useMemo(() => {
    if (!expense || currentParticipantId == null) return null;
    const paid = expense.payments
      .filter((share) => share.participant_id === currentParticipantId)
      .reduce((sum, share) => sum + asNumber(share.amount), 0);
    const owed = expense.owed
      .filter((share) => share.participant_id === currentParticipantId)
      .reduce((sum, share) => sum + asNumber(share.amount), 0);
    return paid - owed;
  }, [expense, currentParticipantId]);

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
          <>
            <Text variant="bodyMedium">{formatDeviceDate(expense.date)}</Text>
            {expense.latitude && expense.longitude ? (
              <Card mode="elevated">
                <Card.Content style={styles.gap}>
                  <LocationMap
                    latitude={expense.latitude}
                    longitude={expense.longitude}
                    height={200}
                  />
                </Card.Content>
              </Card>
            ) : null}
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
              {personalNet !== null && (
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
              )}
              {converted ? (
                <Card mode="elevated" style={styles.metricTile}>
                  <Card.Content>
                    <Text variant="labelLarge">
                      {t("expense.originalAmount")}
                    </Text>
                    <Text variant="headlineSmall">
                      {expense.original_amount} {expense.original_currency}
                    </Text>
                  </Card.Content>
                </Card>
              ) : null}
            </View>

            <Card mode="elevated">
              <Card.Content style={styles.gap}>
                <Text variant="titleMedium">{t("expense.paidBy")}</Text>
                {expense.payments.map((share) => (
                  <List.Item
                    key={share.participant_id}
                    title={share.display_name}
                    description={`${share.amount} ${expense.converted_currency}`}
                    left={() => (
                      <ClickableAvatar
                        name={share.display_name}
                        imageUrl={share.avatar_url}
                      />
                    )}
                  />
                ))}
                <Divider />
                <Text variant="titleMedium">{t("expense.owedBy")}</Text>
                {expense.owed.map((share) => (
                  <List.Item
                    key={share.participant_id}
                    title={share.display_name}
                    description={`${share.amount} ${expense.converted_currency}`}
                    left={() => (
                      <ClickableAvatar
                        name={share.display_name}
                        imageUrl={share.avatar_url}
                      />
                    )}
                  />
                ))}
              </Card.Content>
            </Card>

            {expense.receipts && expense.receipts.length > 0 ? (
              <Card mode="elevated">
                <Card.Content style={styles.gap}>
                  <Text variant="titleMedium">{t("receipts.section")}</Text>
                  <ReceiptList receipts={expense.receipts} />
                </Card.Content>
              </Card>
            ) : null}

            {actionState === "deleted" ? (
              <Text variant="bodyMedium">{t("expense.deleted")}</Text>
            ) : actionState === "archived" ? (
              <Text variant="bodyMedium">{t("group.archivedReadOnly")}</Text>
            ) : (
              <Button
                mode="elevated"
                icon="delete-outline"
                textColor={dangerColor}
                disabled={hasPending}
                onPress={() => setConfirmDelete(true)}
              >
                {t("expense.delete")}
              </Button>
            )}
          </>
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

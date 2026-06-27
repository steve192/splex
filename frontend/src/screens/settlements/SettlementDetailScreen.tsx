import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  Dialog,
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
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useSnackbar } from "../../shared/feedback/SnackbarContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { apiWriteErrorMessage } from "../../shared/lib/apiErrors";
import { formatDeviceDate } from "../../shared/lib/dates";
import { buildParticipantsForFriend } from "../../shared/lib/money";
import { detailActionState } from "../../shared/ledger/detailActionState";
import { usePendingAction } from "../../shared/lib/usePendingAction";
import {
  Friend,
  Group,
  Participant,
  Settlement,
} from "../../shared/types/models";
import { negativeColor } from "../../shared/ui/colors";
import { ClickableAvatar } from "../../shared/ui/ClickableAvatar";
import { MoneyAmountInput } from "../../shared/ui/MoneyAmountInput";
import { Screen } from "../../shared/ui/Screen";
import { SelectionSheet } from "../../shared/ui/SelectionSheet";
import { styles } from "../../shared/ui/styles";
import { isGroupArchived } from "../groups/groupArchivePolicy";
import {
  canSaveSettlementEdit,
  settlementParticipantName,
  settlementParticipantOptions,
} from "./settlementDetailModel";

type SettlementDetailScreenProps =
  | NativeStackScreenProps<OverviewStackParamList, "SettlementDetail">
  | NativeStackScreenProps<ActivityStackParamList, "SettlementDetail">;

export function SettlementDetailScreen({
  route,
  navigation,
}: SettlementDetailScreenProps) {
  const { t } = useI18n();
  const { api } = useAuth();
  const { showSuccess } = useFeedback();
  const { showSnackbar } = useSnackbar();
  const { hasPending, isPending, runPendingAction } = usePendingAction<
    "delete" | "save"
  >();
  const theme = useTheme();
  const dangerColor = negativeColor(theme);
  const settlementId = route.params.id;
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState<number | null>(null);
  const [receiverId, setReceiverId] = useState<number | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [groupArchived, setGroupArchived] = useState(false);
  const [activeSheet, setActiveSheet] = useState<"payer" | "receiver" | null>(
    null,
  );
  const actionState = detailActionState({
    archived: groupArchived,
    deleted: Boolean(settlement?.deleted_at)
  });

  async function load() {
    const row = await api.get<Settlement>(`/api/settlements/${settlementId}/`);
    setSettlement(row);
    setAmount(row.amount);
    setPayerId(row.payer_participant_id);
    setReceiverId(row.receiver_participant_id);
    setGroupArchived(false);
    if (row.group_id) {
      const group = await api.get<Group>(`/api/groups/${row.group_id}/`);
      setParticipants(group.participants ?? []);
      setGroupArchived(isGroupArchived(group));
    } else if (row.friendship_id) {
      const friend = await api.get<Friend>(
        `/api/friends/${row.friendship_id}/`,
      );
      setParticipants(buildParticipantsForFriend(friend));
    }
  }

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [settlementId]),
  );

  useEffect(() => {
    navigation.setOptions({
      title: settlement
        ? `${settlement.amount} ${settlement.currency}`
        : t("settlement.title"),
    });
  }, [navigation, settlement, t]);

  async function deleteSettlement() {
    if (groupArchived) return;
    await runPendingAction("delete", async () => {
      try {
        await api.delete(`/api/settlements/${settlementId}/`);
      } catch (error) {
        setConfirmDelete(false);
        showSnackbar(apiWriteErrorMessage(error, t));
        return;
      }
      setConfirmDelete(false);
      navigation.goBack();
    });
  }

  async function saveEdit() {
    if (groupArchived) return;
    await runPendingAction("save", async () => {
      try {
        await api.patch(`/api/settlements/${settlementId}/`, {
          amount,
          payer_participant_id: payerId,
          receiver_participant_id: receiverId,
        });
        setEditing(false);
        await load();
      } catch (error) {
        setEditing(false);
        showSnackbar(apiWriteErrorMessage(error, t));
        return;
      }
      showSuccess({ icon: "cash-check" });
    });
  }

  const participantOptions = settlementParticipantOptions(participants);
  const saveEnabled = canSaveSettlementEdit({
    hasPending,
    amount,
    payerId,
    receiverId,
    groupArchived,
  });
  let actionContent = (
    <View style={styles.rowActions}>
      <Button
        mode="contained-tonal"
        icon="pencil-outline"
        onPress={() => setEditing(true)}
      >
        {t("common.edit")}
      </Button>
      <Button
        mode="elevated"
        icon="delete-outline"
        textColor={dangerColor}
        disabled={hasPending}
        onPress={() => setConfirmDelete(true)}
      >
        {t("settlement.delete")}
      </Button>
    </View>
  );
  if (actionState === "deleted") {
    actionContent = (
      <Text variant="bodyMedium">{t("settlement.deleted")}</Text>
    );
  } else if (actionState === "archived") {
    actionContent = (
      <Text variant="bodyMedium">{t("group.archivedReadOnly")}</Text>
    );
  }

  return (
    <View style={styles.flex}>
      <Screen>
        {settlement ? (
          <>
            <SettlementContent settlement={settlement} />
            {actionContent}
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
          <Dialog.Title>{t("settlement.delete")}</Dialog.Title>
          <Dialog.Content>
            <Text>{t("settlement.deleteConfirm")}</Text>
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
              onPress={deleteSettlement}
            >
              {t("common.delete")}
            </Button>
          </Dialog.Actions>
        </Dialog>
        <SettlementEditDialog
          visible={editing}
          hasPending={hasPending}
          saving={isPending("save")}
          amount={amount}
          payerId={payerId}
          receiverId={receiverId}
          participants={participants}
          groupArchived={groupArchived}
          saveEnabled={saveEnabled}
          onDismiss={() => setEditing(false)}
          onAmountChange={setAmount}
          onOpenSheet={setActiveSheet}
          onSave={saveEdit}
        />
      </Portal>
      <SelectionSheet
        visible={activeSheet === "payer" && !groupArchived}
        title={t("settlement.payer")}
        options={participantOptions}
        value={payerId}
        onSelect={setPayerId}
        onDismiss={() => setActiveSheet(null)}
      />
      <SelectionSheet
        visible={activeSheet === "receiver" && !groupArchived}
        title={t("settlement.receiver")}
        options={participantOptions}
        value={receiverId}
        onSelect={setReceiverId}
        onDismiss={() => setActiveSheet(null)}
      />
    </View>
  );
}

function SettlementContent({
  settlement,
}: Readonly<{ settlement: Settlement }>) {
  const { t } = useI18n();

  return (
    <>
      <Card mode="elevated">
        <Card.Content style={styles.gap}>
          <Text variant="headlineMedium">
            {settlement.amount} {settlement.currency}
          </Text>
          <Text variant="bodyMedium">
            {formatDeviceDate(settlement.created_at)}
          </Text>
        </Card.Content>
      </Card>

      <Card mode="elevated">
        <Card.Content>
          <SettlementParticipantRow
            title={settlement.payer_display_name ?? t("settlement.payer")}
            description={t("settlement.paid")}
            imageUrl={settlement.payer_avatar_url}
          />
          <SettlementParticipantRow
            title={settlement.receiver_display_name ?? t("settlement.receiver")}
            description={t("settlement.received")}
            imageUrl={settlement.receiver_avatar_url}
          />
        </Card.Content>
      </Card>
    </>
  );
}

function SettlementParticipantRow({
  title,
  description,
  imageUrl,
}: Readonly<{ title: string; description: string; imageUrl?: string }>) {
  return (
    <List.Item
      title={title}
      description={description}
      left={() => <ClickableAvatar name={title} imageUrl={imageUrl} />}
    />
  );
}

function SettlementEditDialog({
  visible,
  hasPending,
  saving,
  amount,
  payerId,
  receiverId,
  participants,
  groupArchived,
  saveEnabled,
  onDismiss,
  onAmountChange,
  onOpenSheet,
  onSave,
}: Readonly<{
  visible: boolean;
  hasPending: boolean;
  saving: boolean;
  amount: string;
  payerId: number | null;
  receiverId: number | null;
  participants: Participant[];
  groupArchived: boolean;
  saveEnabled: boolean;
  onDismiss: () => void;
  onAmountChange: Dispatch<SetStateAction<string>>;
  onOpenSheet: Dispatch<SetStateAction<"payer" | "receiver" | null>>;
  onSave: () => void;
}>) {
  const { t } = useI18n();

  return (
    <Dialog
      visible={visible}
      onDismiss={hasPending ? () => undefined : onDismiss}
    >
      <Dialog.Title>{t("common.edit")}</Dialog.Title>
      <Dialog.Content>
        <View style={styles.gap}>
          <MoneyAmountInput
            mode="outlined"
            label={t("expense.amount")}
            value={amount}
            disabled={groupArchived}
            onChangeText={onAmountChange}
          />
          <SettlementEditParticipantRow
            title={t("settlement.payer")}
            description={settlementParticipantName(participants, payerId)}
            disabled={groupArchived}
            onPress={() => onOpenSheet("payer")}
          />
          <SettlementEditParticipantRow
            title={t("settlement.receiver")}
            description={settlementParticipantName(participants, receiverId)}
            disabled={groupArchived}
            onPress={() => onOpenSheet("receiver")}
          />
        </View>
      </Dialog.Content>
      <Dialog.Actions>
        <Button disabled={hasPending} onPress={onDismiss}>
          {t("common.cancel")}
        </Button>
        <Button loading={saving} disabled={!saveEnabled} onPress={onSave}>
          {t("common.save")}
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}

function SettlementEditParticipantRow({
  title,
  description,
  disabled,
  onPress,
}: Readonly<{
  title: string;
  description: string;
  disabled: boolean;
  onPress: () => void;
}>) {
  return (
    <List.Item
      title={title}
      description={description}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
    />
  );
}

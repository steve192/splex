import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Card, Dialog, List, Portal, Text, TextInput, useTheme } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { ActivityStackParamList, OverviewStackParamList } from "../../application/navigationTypes";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { formatDeviceDate } from "../../shared/lib/dates";
import { buildParticipantsForFriend } from "../../shared/lib/money";
import { Friend, Group, Participant, Settlement } from "../../shared/types/models";
import { negativeColor } from "../../shared/ui/colors";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { SelectionOption, SelectionSheet } from "../../shared/ui/SelectionSheet";
import { styles } from "../../shared/ui/styles";

type SettlementDetailScreenProps =
  | NativeStackScreenProps<OverviewStackParamList, "SettlementDetail">
  | NativeStackScreenProps<ActivityStackParamList, "SettlementDetail">;

export function SettlementDetailScreen({ route, navigation }: SettlementDetailScreenProps) {
  const { t } = useI18n();
  const { api } = useAuth();
  const { showSuccess } = useFeedback();
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
  const [activeSheet, setActiveSheet] = useState<"payer" | "receiver" | null>(null);

  async function load() {
    const row = await api.get<Settlement>(`/api/settlements/${settlementId}/`);
    setSettlement(row);
    setAmount(row.amount);
    setPayerId(row.payer_participant_id);
    setReceiverId(row.receiver_participant_id);
    if (row.group_id) {
      const group = await api.get<Group>(`/api/groups/${row.group_id}/`);
      setParticipants(group.participants ?? []);
    } else if (row.friendship_id) {
      const friend = await api.get<Friend>(`/api/friends/${row.friendship_id}/`);
      setParticipants(buildParticipantsForFriend(friend));
    }
  }

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [settlementId])
  );

  useEffect(() => {
    navigation.setOptions({
      title: settlement
        ? `${settlement.amount} ${settlement.currency}`
        : t("settlement.title")
    });
  }, [navigation, settlement, t]);

  async function deleteSettlement() {
    await api.delete(`/api/settlements/${settlementId}/`);
    setConfirmDelete(false);
    navigation.goBack();
  }

  async function saveEdit() {
    await api.patch(`/api/settlements/${settlementId}/`, {
      amount,
      payer_participant_id: payerId,
      receiver_participant_id: receiverId
    });
    setEditing(false);
    showSuccess({ icon: "cash-check" });
    await load();
  }

  function participantName(participantId: number | null): string {
    return participants.find((participant) => participant.id === participantId)?.display_name ?? "";
  }

  const participantOptions: SelectionOption<number>[] = participants.map((participant) => ({
    value: participant.id,
    label: participant.display_name
  }));

  return (
    <View style={styles.flex}>
      <Screen>
        {settlement ? (
          <>
            <Card mode="elevated">
              <Card.Content style={styles.gap}>
                <Text variant="headlineMedium">
                  {settlement.amount} {settlement.currency}
                </Text>
                <Text variant="bodyMedium">{formatDeviceDate(settlement.created_at)}</Text>
              </Card.Content>
            </Card>

            <Card mode="elevated">
              <Card.Content>
                <List.Item
                  title={settlement.payer_display_name ?? t("settlement.payer")}
                  description={t("settlement.paid")}
                  left={() => <PersonAvatar name={settlement.payer_display_name} imageUrl={settlement.payer_avatar_url} />}
                />
                <List.Item
                  title={settlement.receiver_display_name ?? t("settlement.receiver")}
                  description={t("settlement.received")}
                  left={() => <PersonAvatar name={settlement.receiver_display_name} imageUrl={settlement.receiver_avatar_url} />}
                />
              </Card.Content>
            </Card>

            {settlement.deleted_at ? (
              <Text variant="bodyMedium">{t("settlement.deleted")}</Text>
            ) : (
              <View style={styles.rowActions}>
                <Button mode="contained-tonal" icon="pencil-outline" onPress={() => setEditing(true)}>
                  {t("common.edit")}
                </Button>
                <Button mode="elevated" icon="delete-outline" textColor={dangerColor} onPress={() => setConfirmDelete(true)}>
                  {t("settlement.delete")}
                </Button>
              </View>
            )}
          </>
        ) : null}
      </Screen>

      <Portal>
        <Dialog visible={confirmDelete} onDismiss={() => setConfirmDelete(false)}>
          <Dialog.Title>{t("settlement.delete")}</Dialog.Title>
          <Dialog.Content>
            <Text>{t("settlement.deleteConfirm")}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDelete(false)}>{t("common.cancel")}</Button>
            <Button onPress={deleteSettlement}>{t("common.delete")}</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={editing} onDismiss={() => setEditing(false)}>
          <Dialog.Title>{t("common.edit")}</Dialog.Title>
          <Dialog.Content>
            <View style={styles.gap}>
              <TextInput
                mode="outlined"
                label={t("expense.amount")}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
              <List.Item
                title={t("settlement.payer")}
                description={participantName(payerId)}
                onPress={() => setActiveSheet("payer")}
              />
              <List.Item
                title={t("settlement.receiver")}
                description={participantName(receiverId)}
                onPress={() => setActiveSheet("receiver")}
              />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditing(false)}>{t("common.cancel")}</Button>
            <Button
              disabled={!amount || !payerId || !receiverId || payerId === receiverId}
              onPress={saveEdit}
            >
              {t("common.save")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <SelectionSheet
        visible={activeSheet === "payer"}
        title={t("settlement.payer")}
        options={participantOptions}
        value={payerId}
        onSelect={setPayerId}
        onDismiss={() => setActiveSheet(null)}
      />
      <SelectionSheet
        visible={activeSheet === "receiver"}
        title={t("settlement.receiver")}
        options={participantOptions}
        value={receiverId}
        onSelect={setReceiverId}
        onDismiss={() => setActiveSheet(null)}
      />
    </View>
  );
}

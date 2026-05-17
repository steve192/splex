import { useEffect, useState } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  Dialog,
  List,
  Portal,
  SegmentedButtons,
  Snackbar,
  Switch,
  Text,
  TextInput
} from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { Group, Participant, SplitMethod } from "../../shared/types/models";
import { ImageUploadField } from "../../shared/ui/ImageUploadField";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

const DEFAULT_SPLIT_OPTIONS: Array<{ value: SplitMethod | "equal"; key: string }> = [
  { value: "equal_all", key: "split.equal_all" },
  { value: "exact", key: "split.exact" },
  { value: "percentage", key: "split.percentage" },
  { value: "adjusted_equal", key: "split.adjusted_equal" }
];

export function GroupSettingsScreen({ route, navigation }: any) {
  const { t } = useI18n();
  const { api } = useAuth();
  const { showSuccess } = useFeedback();
  const groupId = route.params.id;
  const [group, setGroup] = useState<Group | null>(null);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [iconUrl, setIconUrl] = useState("");
  const [iconImage, setIconImage] = useState("");
  const [archived, setArchived] = useState(false);
  const [defaultSplitMethod, setDefaultSplitMethod] = useState<SplitMethod>("equal_all");
  const [removeTarget, setRemoveTarget] = useState<Participant | null>(null);
  const [renameTarget, setRenameTarget] = useState<Participant | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [newParticipantName, setNewParticipantName] = useState("");
  const [snackbar, setSnackbar] = useState("");

  async function load() {
    const row = await api.get<Group>(`/api/groups/${groupId}/`);
    setGroup(row);
    setName(row.name);
    setCurrency(row.default_currency);
    setIconUrl(row.icon_url ?? "");
    setArchived(Boolean(row.archived_at));
    setDefaultSplitMethod(row.default_split_method ?? "equal_all");
  }

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => load().catch(() => undefined));
    return unsubscribe;
  }, [navigation, groupId]);

  async function save() {
    await api.patch(`/api/groups/${groupId}/`, {
      name,
      default_currency: currency.toUpperCase(),
      ...(iconImage ? { icon_image: iconImage } : {}),
      default_split_method: defaultSplitMethod,
      default_split_payload: {}
    });
    await load();
    showSuccess({ icon: "check" });
    navigation.navigate("GroupDetail", { id: groupId });
  }

  async function saveArchive() {
    await api.patch(`/api/groups/${groupId}/`, { archived });
    await load();
    showSuccess({ icon: "archive-check-outline" });
    setSnackbar(t("group.saved"));
  }

  async function deleteCurrentGroup() {
    await api.delete(`/api/groups/${groupId}/`);
    setDeleteConfirmVisible(false);
    navigation.navigate("OverviewHome");
  }

  async function removeParticipant() {
    if (!removeTarget) return;
    await api.delete(`/api/groups/${groupId}/participants/${removeTarget.id}/`);
    setRemoveTarget(null);
    await load();
  }

  async function addParticipant() {
    if (!newParticipantName.trim()) return;
    await api.post(`/api/groups/${groupId}/participants/`, {
      display_name: newParticipantName.trim()
    });
    setNewParticipantName("");
    showSuccess({ icon: "account-check-outline" });
    await load();
  }

  async function renameParticipant() {
    if (!renameTarget || !renameValue.trim()) return;
    await api.patch(`/api/groups/${groupId}/participants/${renameTarget.id}/`, {
      display_name: renameValue.trim()
    });
    setRenameTarget(null);
    setRenameValue("");
    showSuccess({ icon: "check" });
    await load();
  }

  async function createInvite(targetParticipantId?: number) {
    const body = targetParticipantId ? { target_participant_id: targetParticipantId } : {};
    const response = await api.post<{ url: string }>(`/api/groups/${groupId}/invitations/`, body);
    setSnackbar(response.url);
  }

  function openRename(participant: Participant) {
    setRenameTarget(participant);
    setRenameValue(participant.display_name);
  }

  return (
    <View style={styles.flex}>
      <Screen>
        <Text variant="headlineSmall">{t("group.settings")}</Text>
        <Card mode="elevated">
          <Card.Content style={styles.gap}>
            <TextInput mode="outlined" label={t("group.name")} value={name} onChangeText={setName} />
            <ImageUploadField
              label={t("group.icon")}
              name={name}
              imageUrl={iconUrl}
              onChange={(image) => {
                setIconImage(image.dataUrl);
                setIconUrl(image.previewUrl);
              }}
            />
            <TextInput
              mode="outlined"
              label={t("expense.currency")}
              value={currency}
              onChangeText={(value) => setCurrency(value.toUpperCase())}
              autoCapitalize="characters"
              maxLength={3}
            />
            <Text variant="titleMedium">{t("group.defaultSplit")}</Text>
            <SegmentedButtons
              value={defaultSplitMethod}
              onValueChange={(value) => setDefaultSplitMethod(value as SplitMethod)}
              buttons={DEFAULT_SPLIT_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.key)
              }))}
            />
            {group ? (
              <View style={styles.gap}>
                <Text variant="bodyMedium">
                  {t("group.createdAt")}: {new Date(group.created_at ?? "").toLocaleDateString()}
                </Text>
                <Text variant="bodyMedium">
                  {t("group.updatedAt")}: {new Date(group.updated_at ?? "").toLocaleDateString()}
                </Text>
              </View>
            ) : null}
            <Button mode="contained" disabled={!name} onPress={save}>
              {t("common.save")}
            </Button>
          </Card.Content>
        </Card>

        <View style={styles.rowBetween}>
          <Text variant="titleLarge">{t("group.members")}</Text>
          <Button mode="elevated" icon="link-variant" onPress={() => createInvite()}>
            {t("invite.create")}
          </Button>
        </View>
        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <Text variant="titleMedium">{t("participant.add")}</Text>
            <View style={styles.formRow}>
              <TextInput
                mode="outlined"
                label={t("participant.name")}
                value={newParticipantName}
                onChangeText={setNewParticipantName}
                style={styles.flex}
              />
              <Button mode="contained" disabled={!newParticipantName.trim()} onPress={addParticipant}>
                {t("common.save")}
              </Button>
            </View>
          </Card.Content>
        </Card>
        {group?.participants?.map((participant) => (
          <Card key={participant.id} mode="elevated" style={styles.card}>
            <Card.Content>
              <List.Item
                title={participant.display_name}
                description={participant.kind === "unregistered" ? t("participant.unregistered") : t("participant.registered")}
                left={() => <PersonAvatar name={participant.display_name} imageUrl={participant.avatar_url} />}
                right={() => (
                  <View style={styles.rowActions}>
                    {participant.kind === "unregistered" ? (
                      <>
                        <Button mode="text" onPress={() => openRename(participant)}>
                          {t("common.edit")}
                        </Button>
                        <Button mode="text" onPress={() => createInvite(participant.id)}>
                          {t("invite.targeted")}
                        </Button>
                      </>
                    ) : null}
                    <Button mode="text" textColor="#B3261E" onPress={() => setRemoveTarget(participant)}>
                      {t("common.delete")}
                    </Button>
                  </View>
                )}
              />
            </Card.Content>
          </Card>
        ))}

        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <Text variant="titleMedium">{t("group.management")}</Text>
            <List.Item
              title={t("group.archived")}
              right={() => <Switch value={archived} onValueChange={setArchived} />}
            />
            <Button mode="elevated" onPress={saveArchive}>
              {t("group.saveArchive")}
            </Button>
            <Button
              mode="contained-tonal"
              icon="delete-outline"
              textColor="#B3261E"
              onPress={() => setDeleteConfirmVisible(true)}
            >
              {t("group.delete")}
            </Button>
          </Card.Content>
        </Card>
      </Screen>

      <Portal>
        <Dialog visible={!!removeTarget} onDismiss={() => setRemoveTarget(null)}>
          <Dialog.Title>{t("group.removeMember")}</Dialog.Title>
          <Dialog.Content>
            <Text>{removeTarget ? removeTarget.display_name : ""}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRemoveTarget(null)}>{t("common.cancel")}</Button>
            <Button onPress={removeParticipant}>{t("common.delete")}</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={!!renameTarget} onDismiss={() => setRenameTarget(null)}>
          <Dialog.Title>{t("participant.rename")}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label={t("participant.name")}
              value={renameValue}
              onChangeText={setRenameValue}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenameTarget(null)}>{t("common.cancel")}</Button>
            <Button onPress={renameParticipant} disabled={!renameValue.trim()}>{t("common.save")}</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={deleteConfirmVisible} onDismiss={() => setDeleteConfirmVisible(false)}>
          <Dialog.Title>{t("group.delete")}</Dialog.Title>
          <Dialog.Content>
            <Text>{t("group.deleteConfirm")}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteConfirmVisible(false)}>{t("common.cancel")}</Button>
            <Button textColor="#B3261E" onPress={deleteCurrentGroup}>{t("common.delete")}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar("")} duration={9000}>
        {snackbar}
      </Snackbar>
    </View>
  );
}

import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Dialog,
  List,
  Portal,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { OverviewStackParamList } from "../../application/navigationTypes";
import { useFeedback } from "../../shared/feedback/FeedbackContext";
import { useSnackbar } from "../../shared/feedback/SnackbarContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { apiWriteErrorMessage } from "../../shared/lib/apiErrors";
import { shareLink } from "../../shared/lib/shareLink";
import { useCachedQuery } from "../../shared/lib/useCachedQuery";
import { CURRENCIES } from "../../shared/lib/currencies";
import { formatDeviceDate } from "../../shared/lib/dates";
import { asNumber } from "../../shared/lib/money";
import { usePendingAction } from "../../shared/lib/usePendingAction";
import {
  Friend,
  Group,
  GroupBalance,
  Participant,
  SplitMethod,
} from "../../shared/types/models";
import { ImageUploadField } from "../../shared/ui/ImageUploadField";
import { ManualCopyDialog } from "../../shared/ui/ManualCopyDialog";
import { negativeColor } from "../../shared/ui/colors";
import { Screen } from "../../shared/ui/Screen";
import {
  SelectionOption,
  SelectionSheet,
} from "../../shared/ui/SelectionSheet";
import { styles } from "../../shared/ui/styles";
import {
  buildAddParticipantPayload,
  getSuggestedFriends,
  shouldDeleteGroupOnLeave,
} from "./groupSettingsHelpers";
import { GroupMembersSection } from "./GroupMembersSection";
import { RemoveParticipantDialog } from "./RemoveParticipantDialog";

const DEFAULT_SPLIT_OPTIONS: Array<{
  value: SplitMethod | "equal";
  key: string;
}> = [
  { value: "equal_all", key: "split.shortEqual" },
  { value: "exact", key: "split.shortExact" },
  { value: "percentage", key: "split.shortPercentage" },
  { value: "adjusted_equal", key: "split.shortAdjusted" },
];

type GroupSettingsScreenProps = NativeStackScreenProps<
  OverviewStackParamList,
  "GroupSettings"
>;
type GroupSettingsData = {
  group: Group;
  friends: Friend[];
  balances: GroupBalance[];
};
type GroupSettingsAction =
  | "save"
  | "archive"
  | "delete"
  | "leave"
  | "remove-participant"
  | "add-participant"
  | "rename-participant"
  | "invite"
  | `add-friend:${number}`
  | `invite:${number}`;

export function GroupSettingsScreen({
  route,
  navigation,
}: Readonly<GroupSettingsScreenProps>) {
  const { t } = useI18n();
  const { api } = useAuth();
  const { showSuccess } = useFeedback();
  const { showSnackbar } = useSnackbar();
  const {
    hasPending,
    isPending,
    pending: pendingAction,
    runPendingAction,
  } = usePendingAction<GroupSettingsAction>();
  const theme = useTheme();
  const dangerColor = negativeColor(theme);
  const groupId = route.params.id;
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const [iconUrl, setIconUrl] = useState("");
  const [iconImage, setIconImage] = useState("");
  const [iconAttribution, setIconAttribution] = useState("");
  const [archived, setArchived] = useState(false);
  const [defaultSplitMethod, setDefaultSplitMethod] =
    useState<SplitMethod>("equal_all");
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [archiveDirty, setArchiveDirty] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Participant | null>(null);
  const [renameTarget, setRenameTarget] = useState<Participant | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [newParticipantName, setNewParticipantName] = useState("");
  const [manualCopyLink, setManualCopyLink] = useState("");
  const settingsQuery = useCachedQuery<GroupSettingsData>({
    load: useCallback(
      async ({ cachedGet }) => {
        const [group, friends, balances] = await Promise.all([
          cachedGet<Group>(api, `/api/groups/${groupId}/`),
          cachedGet<Friend[]>(api, "/api/friends/"),
          cachedGet<GroupBalance[]>(api, `/api/groups/${groupId}/balances/`),
        ]);
        return { group, friends, balances };
      },
      [api, groupId],
    ),
  });
  const group = settingsQuery.data?.group ?? null;
  const friends = settingsQuery.data?.friends ?? [];
  const balances = settingsQuery.data?.balances ?? [];
  const currencyOptions: SelectionOption<string>[] = CURRENCIES.map((code) => ({
    value: code,
    label: code,
  }));
  const suggestedFriends = getSuggestedFriends(
    newParticipantName,
    friends,
    group?.participants ?? [],
  );
  const currentParticipant =
    group?.participants?.find(
      (participant) => participant.id === group.current_participant_id,
    ) ?? null;
  const isLastActiveMember = shouldDeleteGroupOnLeave(
    group?.participants ?? [],
    group?.current_participant_id,
  );
  const deleteGroupName = group?.name ?? "";
  const addingFriendId = pendingAction?.startsWith("add-friend:")
    ? Number(pendingAction.split(":")[1])
    : null;
  const targetedInviteParticipantId = pendingAction?.startsWith("invite:")
    ? Number(pendingAction.split(":")[1])
    : null;
  // A group can only be deleted once it is settled up, mirroring friend
  // removal - removal must never silently drop an unsettled balance.
  const isSettled = !balances.some((row) => asNumber(row.amount) !== 0);
  const deleteGroupEnabled =
    isSettled && deleteConfirmName.trim() === deleteGroupName.trim();

  useFocusEffect(
    useCallback(() => {
      settingsQuery.reload().catch(() => undefined);
    }, [settingsQuery.reload]),
  );

  useEffect(() => {
    setDetailsDirty(false);
    setArchiveDirty(false);
  }, [groupId]);

  useEffect(() => {
    if (!group) return;
    if (!detailsDirty) {
      setName(group.name);
      setCurrency(group.default_currency);
      setIconUrl(group.icon_url ?? "");
      setDefaultSplitMethod(group.default_split_method ?? "equal_all");
    }
    if (!archiveDirty) {
      setArchived(Boolean(group.archived_at));
    }
  }, [archiveDirty, detailsDirty, group]);

  async function save() {
    await runPendingAction("save", async () => {
      try {
        await api.patch(`/api/groups/${groupId}/`, {
          name,
          default_currency: currency.toUpperCase(),
          ...(iconImage
            ? { icon_image: iconImage, icon_attribution: iconAttribution }
            : {}),
          default_split_method: defaultSplitMethod,
          default_split_payload: {},
        });
        await settingsQuery.reloadFresh();
      } catch (error) {
        showSnackbar(apiWriteErrorMessage(error, t));
        return;
      }
      setDetailsDirty(false);
      showSuccess({ icon: "check" });
      navigation.navigate("GroupDetail", { id: groupId });
    });
  }

  async function saveArchive() {
    await runPendingAction("archive", async () => {
      try {
        await api.patch(`/api/groups/${groupId}/`, { archived });
        await settingsQuery.reloadFresh();
      } catch (error) {
        showSnackbar(apiWriteErrorMessage(error, t));
        return;
      }
      setArchiveDirty(false);
      showSuccess({ icon: "archive-check-outline" });
      showSnackbar(t("group.saved"), { duration: 9000 });
    });
  }

  async function deleteCurrentGroup() {
    if (!deleteGroupEnabled) return;
    await runPendingAction("delete", async () => {
      try {
        await api.delete(`/api/groups/${groupId}/`);
      } catch (error) {
        setDeleteConfirmVisible(false);
        showSnackbar(apiWriteErrorMessage(error, t));
        return;
      }
      setDeleteConfirmName("");
      setDeleteConfirmVisible(false);
      navigation.navigate("OverviewHome");
    });
  }

  async function leaveCurrentGroup() {
    await runPendingAction("leave", async () => {
      try {
        await api.post(`/api/groups/${groupId}/leave/`, {});
      } catch (error) {
        setLeaveConfirmVisible(false);
        showSnackbar(apiWriteErrorMessage(error, t));
        return;
      }
      setLeaveConfirmVisible(false);
      navigation.navigate("OverviewHome");
    });
  }

  async function removeParticipant() {
    if (!removeTarget) return;
    await runPendingAction("remove-participant", async () => {
      try {
        await api.delete(
          `/api/groups/${groupId}/participants/${removeTarget.id}/`,
        );
        await settingsQuery.reloadFresh();
      } catch (error) {
        showSnackbar(apiWriteErrorMessage(error, t));
      }
      setRemoveTarget(null);
    });
  }

  async function addParticipant(friend?: Friend) {
    const payload = friend
      ? { friend_participant_id: friend.participant_id }
      : buildAddParticipantPayload(
          newParticipantName,
          friends,
          group?.participants ?? [],
        );
    if (!payload) return;
    const key: GroupSettingsAction = friend
      ? `add-friend:${friend.id}`
      : "add-participant";
    await runPendingAction(key, async () => {
      try {
        await api.post(`/api/groups/${groupId}/participants/`, payload);
        await settingsQuery.reloadFresh();
      } catch (error) {
        showSnackbar(apiWriteErrorMessage(error, t));
        return;
      }
      setNewParticipantName("");
      showSuccess({ icon: "account-check-outline" });
    });
  }

  async function renameParticipant() {
    if (!renameTarget || !renameValue.trim()) return;
    await runPendingAction("rename-participant", async () => {
      try {
        await api.patch(
          `/api/groups/${groupId}/participants/${renameTarget.id}/`,
          {
            display_name: renameValue.trim(),
          },
        );
        await settingsQuery.reloadFresh();
      } catch (error) {
        showSnackbar(apiWriteErrorMessage(error, t));
        return;
      }
      setRenameTarget(null);
      setRenameValue("");
      showSuccess({ icon: "check" });
    });
  }

  async function createInvite(targetParticipantId?: number) {
    const body = targetParticipantId
      ? { target_participant_id: targetParticipantId }
      : {};
    const key: GroupSettingsAction = targetParticipantId
      ? `invite:${targetParticipantId}`
      : "invite";
    await runPendingAction(key, async () => {
      let response: { url: string };
      try {
        response = await api.post<{ url: string }>(
          `/api/groups/${groupId}/invitations/`,
          body,
        );
      } catch (error) {
        showSnackbar(apiWriteErrorMessage(error, t));
        return;
      }
      const result = await shareLink(response.url, {
        title: t("invite.shareTitle"),
      });
      if (result === "copied") {
        showSnackbar(t("invite.copied"), { duration: 9000 });
      } else if (result === "failed") {
        setManualCopyLink(response.url);
      }
    });
  }

  function openRename(participant: Participant) {
    setRenameTarget(participant);
    setRenameValue(participant.display_name);
  }

  return (
    <View style={styles.flex}>
      <Screen>
        <View style={styles.inline}>
          <Text variant="headlineSmall">{t("group.settings")}</Text>
          {settingsQuery.loading && <ActivityIndicator size={16} />}
        </View>
        <Card mode="elevated">
          <Card.Content style={styles.gap}>
            <TextInput
              mode="outlined"
              label={t("group.name")}
              value={name}
              onChangeText={(value) => {
                setName(value);
                setDetailsDirty(true);
              }}
            />
            <ImageUploadField
              label={t("group.icon")}
              name={name}
              imageUrl={iconUrl}
              searchQuery={name}
              onChange={(image) => {
                setIconImage(image.dataUrl);
                setIconUrl(image.previewUrl);
                setIconAttribution(image.attribution ?? "");
                setDetailsDirty(true);
              }}
            />
            <Button
              mode="elevated"
              onPress={() => {
                setCurrencySheetOpen(true);
                setDetailsDirty(true);
              }}
            >
              {t("expense.currency")}: {currency}
            </Button>
            <Text variant="titleMedium">{t("group.defaultSplit")}</Text>
            <SegmentedButtons
              value={defaultSplitMethod}
              onValueChange={(value) => {
                setDefaultSplitMethod(value as SplitMethod);
                setDetailsDirty(true);
              }}
              buttons={DEFAULT_SPLIT_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.key),
              }))}
            />
            {group ? (
              <View style={styles.gap}>
                <Text variant="bodyMedium">
                  {t("group.createdAt")}: {formatDeviceDate(group.created_at)}
                </Text>
                <Text variant="bodyMedium">
                  {t("group.updatedAt")}: {formatDeviceDate(group.updated_at)}
                </Text>
              </View>
            ) : null}
            <Button
              mode="contained"
              loading={isPending("save")}
              disabled={hasPending || !name}
              onPress={save}
            >
              {t("common.save")}
            </Button>
          </Card.Content>
        </Card>

        <GroupMembersSection
          participants={group?.participants ?? []}
          currentParticipantId={group?.current_participant_id}
          newParticipantName={newParticipantName}
          onNewParticipantNameChange={setNewParticipantName}
          suggestedFriends={suggestedFriends}
          dangerColor={dangerColor}
          onAddFriend={addParticipant}
          onAddNew={() => addParticipant()}
          onRename={openRename}
          onRemove={setRemoveTarget}
          onCreateInvite={createInvite}
          actionsDisabled={hasPending}
          addingFriendId={addingFriendId}
          addNewLoading={isPending("add-participant")}
          inviteLoading={isPending("invite")}
          targetedInviteParticipantId={targetedInviteParticipantId}
        />

        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.gap}>
            <Text variant="titleMedium">{t("group.management")}</Text>
            <List.Item
              title={t("group.archived")}
              right={renderArchiveSwitch(archived, (value) => {
                setArchived(value);
                setArchiveDirty(true);
              })}
            />
            <Button
              mode="elevated"
              loading={isPending("archive")}
              disabled={hasPending}
              onPress={saveArchive}
            >
              {t("group.saveArchive")}
            </Button>
            <Button
              mode="contained-tonal"
              icon="logout"
              disabled={hasPending}
              onPress={() => setLeaveConfirmVisible(true)}
            >
              {t("group.leave")}
            </Button>
            {!isSettled && (
              <Text variant="bodyMedium">{t("group.deleteBlocked")}</Text>
            )}
            <Button
              mode="contained-tonal"
              icon="delete-outline"
              textColor={dangerColor}
              disabled={hasPending || !isSettled}
              onPress={() => {
                setDeleteConfirmName("");
                setDeleteConfirmVisible(true);
              }}
            >
              {t("group.delete")}
            </Button>
          </Card.Content>
        </Card>
      </Screen>

      <Portal>
        <RemoveParticipantDialog
          api={api}
          groupId={groupId}
          target={removeTarget}
          onDismiss={() => setRemoveTarget(null)}
          onConfirm={removeParticipant}
          confirming={isPending("remove-participant")}
        />
        <RemoveParticipantDialog
          api={api}
          groupId={groupId}
          target={currentParticipant}
          visible={leaveConfirmVisible && !!currentParticipant}
          title={t("group.leave")}
          confirmLabel={t("group.leave")}
          extraMessage={
            isLastActiveMember
              ? t("group.leaveLastMember")
              : t("group.leaveConfirm")
          }
          groupWillBeDeleted={isLastActiveMember}
          onDismiss={() => setLeaveConfirmVisible(false)}
          onConfirm={leaveCurrentGroup}
          confirming={isPending("leave")}
        />
        <Dialog
          visible={!!renameTarget}
          onDismiss={hasPending ? () => undefined : () => setRenameTarget(null)}
        >
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
            <Button disabled={hasPending} onPress={() => setRenameTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              loading={isPending("rename-participant")}
              disabled={hasPending || !renameValue.trim()}
              onPress={renameParticipant}
            >
              {t("common.save")}
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog
          visible={deleteConfirmVisible}
          onDismiss={
            hasPending
              ? () => undefined
              : () => {
                  setDeleteConfirmVisible(false);
                  setDeleteConfirmName("");
                }
          }
        >
          <Dialog.Title>{t("group.delete")}</Dialog.Title>
          <Dialog.Content>
            <View style={styles.gap}>
              <Text>{t("group.deleteConfirm")}</Text>
              <Text>
                {t("group.deleteTypeName", { name: deleteGroupName })}
              </Text>
              <TextInput
                mode="outlined"
                label={t("group.deleteTypeNameLabel")}
                value={deleteConfirmName}
                onChangeText={setDeleteConfirmName}
                autoCapitalize="none"
              />
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              disabled={hasPending}
              onPress={() => {
                setDeleteConfirmVisible(false);
                setDeleteConfirmName("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              textColor={dangerColor}
              loading={isPending("delete")}
              onPress={deleteCurrentGroup}
              disabled={hasPending || !deleteGroupEnabled}
            >
              {t("common.delete")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <ManualCopyDialog
        visible={!!manualCopyLink}
        title={t("invite.copyManual")}
        description={t("invite.copyManualHelp")}
        value={manualCopyLink}
        label={t("invite.copyLabel")}
        onDismiss={() => setManualCopyLink("")}
      />
      <SelectionSheet
        visible={currencySheetOpen}
        title={t("expense.currency")}
        options={currencyOptions}
        value={currency}
        onSelect={(value) => {
          setCurrency(value);
          setDetailsDirty(true);
        }}
        onDismiss={() => setCurrencySheetOpen(false)}
      />
    </View>
  );
}

function ArchiveSwitch({
  value,
  onValueChange,
}: Readonly<{
  value: boolean;
  onValueChange: (value: boolean) => void;
}>) {
  return <Switch value={value} onValueChange={onValueChange} />;
}

function renderArchiveSwitch(
  value: boolean,
  onValueChange: (value: boolean) => void,
) {
  return function ArchiveSwitchRenderer() {
    return <ArchiveSwitch value={value} onValueChange={onValueChange} />;
  };
}

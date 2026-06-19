import { View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  List,
  Text,
  TextInput,
} from "react-native-paper";

import { useI18n } from "../../shared/i18n/I18nContext";
import { Friend, Participant } from "../../shared/types/models";
import { ClickableAvatar } from "../../shared/ui/ClickableAvatar";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { styles } from "../../shared/ui/styles";
import { canRemoveParticipant } from "./participantActions";

type GroupMembersSectionProps = {
  participants: Participant[];
  currentParticipantId?: number;
  newParticipantName: string;
  onNewParticipantNameChange: (value: string) => void;
  suggestedFriends: Friend[];
  dangerColor: string;
  onAddFriend: (friend: Friend) => void;
  onAddNew: () => void;
  onRename: (participant: Participant) => void;
  onRemove: (participant: Participant) => void;
  onCreateInvite: (participantId?: number) => void;
  actionsDisabled?: boolean;
  addingFriendId?: number | null;
  addNewLoading?: boolean;
  inviteLoading?: boolean;
  targetedInviteParticipantId?: number | null;
};

/** Members management: invite, add by name/suggestion, and the participant list. */
export function GroupMembersSection({
  participants,
  currentParticipantId,
  newParticipantName,
  onNewParticipantNameChange,
  suggestedFriends,
  dangerColor,
  onAddFriend,
  onAddNew,
  onRename,
  onRemove,
  onCreateInvite,
  actionsDisabled = false,
  addingFriendId = null,
  addNewLoading = false,
  inviteLoading = false,
  targetedInviteParticipantId = null,
}: Readonly<GroupMembersSectionProps>) {
  const { t } = useI18n();
  return (
    <>
      <View style={styles.rowBetween}>
        <Text variant="titleLarge">{t("group.members")}</Text>
        <Button
          mode="elevated"
          icon="link-variant"
          loading={inviteLoading}
          disabled={actionsDisabled}
          onPress={() => onCreateInvite()}
        >
          {t("invite.create")}
        </Button>
      </View>
      <Card mode="elevated" style={styles.card}>
        <Card.Content style={styles.gap}>
          <Text variant="titleMedium">{t("participant.add")}</Text>
          <TextInput
            mode="outlined"
            label={t("participant.name")}
            value={newParticipantName}
            onChangeText={onNewParticipantNameChange}
          />
          {suggestedFriends.length ? (
            <View style={styles.suggestionList}>
              {suggestedFriends.map((friend) => (
                <FriendSuggestionItem
                  key={friend.id}
                  friend={friend}
                  description={t("participant.registered")}
                  onPress={() => onAddFriend(friend)}
                  disabled={actionsDisabled}
                  loading={addingFriendId === friend.id}
                />
              ))}
            </View>
          ) : null}
          <Button
            mode="contained"
            loading={addNewLoading}
            disabled={actionsDisabled || !newParticipantName.trim()}
            onPress={onAddNew}
          >
            {t("common.save")}
          </Button>
        </Card.Content>
      </Card>
      {participants.map((participant) => (
        <Card key={participant.id} mode="elevated" style={styles.card}>
          <Card.Content>
            {participant.kind === "unregistered" ? (
              <View style={styles.memberCardRow}>
                <ClickableAvatar
                  name={participant.display_name}
                  imageUrl={participant.avatar_url}
                />
                <View style={styles.memberContent}>
                  <Text variant="titleMedium">{participant.display_name}</Text>
                  <Text variant="bodyMedium">
                    {t("participant.unregistered")}
                  </Text>
                  <View style={[styles.rowActions, styles.memberActionRow]}>
                    <Button
                      mode="text"
                      disabled={actionsDisabled}
                      onPress={() => onRename(participant)}
                    >
                      {t("common.edit")}
                    </Button>
                    <Button
                      mode="text"
                      loading={targetedInviteParticipantId === participant.id}
                      disabled={actionsDisabled}
                      onPress={() => onCreateInvite(participant.id)}
                    >
                      {t("invite.targeted")}
                    </Button>
                    {canRemoveParticipant(participant, currentParticipantId) ? (
                      <Button
                        mode="text"
                        textColor={dangerColor}
                        disabled={actionsDisabled}
                        onPress={() => onRemove(participant)}
                      >
                        {t("common.delete")}
                      </Button>
                    ) : null}
                  </View>
                </View>
              </View>
            ) : (
              <RegisteredParticipantItem
                participant={participant}
                description={t("participant.registered")}
                dangerColor={dangerColor}
                deleteLabel={t("common.delete")}
                removable={canRemoveParticipant(
                  participant,
                  currentParticipantId,
                )}
                disabled={actionsDisabled}
                onRemove={() => onRemove(participant)}
              />
            )}
          </Card.Content>
        </Card>
      ))}
    </>
  );
}

function FriendSuggestionItem({
  friend,
  description,
  onPress,
  disabled,
  loading,
}: Readonly<{
  friend: Friend;
  description: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}>) {
  return (
    <List.Item
      style={styles.listItemDense}
      title={friend.display_name}
      description={description}
      left={renderPersonAvatar(friend.display_name, friend.avatar_url)}
      right={loading ? renderListSpinner() : renderListIcon("account-plus")}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
    />
  );
}

function RegisteredParticipantItem({
  participant,
  description,
  dangerColor,
  deleteLabel,
  removable,
  disabled,
  onRemove,
}: Readonly<{
  participant: Participant;
  description: string;
  dangerColor: string;
  deleteLabel: string;
  removable: boolean;
  disabled?: boolean;
  onRemove: () => void;
}>) {
  return (
    <List.Item
      title={participant.display_name}
      description={description}
      left={renderClickableAvatar(
        participant.display_name,
        participant.avatar_url,
      )}
      right={renderDeleteAction(
        removable,
        dangerColor,
        deleteLabel,
        onRemove,
        disabled,
      )}
    />
  );
}

function renderPersonAvatar(name: string, imageUrl?: string) {
  return function PersonAvatarRenderer() {
    return <PersonAvatar name={name} imageUrl={imageUrl} />;
  };
}

function renderClickableAvatar(name: string, imageUrl?: string) {
  return function ClickableAvatarRenderer() {
    return <ClickableAvatar name={name} imageUrl={imageUrl} />;
  };
}

function renderListIcon(icon: string) {
  return function ListIconRenderer(props: { color: string; style?: any }) {
    return <List.Icon {...props} icon={icon} />;
  };
}

function renderListSpinner() {
  return function ListSpinnerRenderer() {
    return <ActivityIndicator size={18} />;
  };
}

function renderDeleteAction(
  removable: boolean,
  dangerColor: string,
  deleteLabel: string,
  onRemove: () => void,
  disabled = false,
) {
  return function DeleteActionRenderer() {
    if (!removable) return null;
    return (
      <Button
        mode="text"
        textColor={dangerColor}
        disabled={disabled}
        onPress={onRemove}
      >
        {deleteLabel}
      </Button>
    );
  };
}

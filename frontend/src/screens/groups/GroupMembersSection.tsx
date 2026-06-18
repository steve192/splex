import { View } from "react-native";
import { Button, Card, List, Text, TextInput } from "react-native-paper";

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
  onCreateInvite
}: Readonly<GroupMembersSectionProps>) {
  const { t } = useI18n();
  return (
    <>
      <View style={styles.rowBetween}>
        <Text variant="titleLarge">{t("group.members")}</Text>
        <Button mode="elevated" icon="link-variant" onPress={() => onCreateInvite()}>
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
                />
              ))}
            </View>
          ) : null}
          <Button mode="contained" disabled={!newParticipantName.trim()} onPress={onAddNew}>
            {t("common.save")}
          </Button>
        </Card.Content>
      </Card>
      {participants.map((participant) => (
        <Card key={participant.id} mode="elevated" style={styles.card}>
          <Card.Content>
            {participant.kind === "unregistered" ? (
              <View style={styles.memberCardRow}>
                <ClickableAvatar name={participant.display_name} imageUrl={participant.avatar_url} />
                <View style={styles.memberContent}>
                  <Text variant="titleMedium">{participant.display_name}</Text>
                  <Text variant="bodyMedium">{t("participant.unregistered")}</Text>
                  <View style={[styles.rowActions, styles.memberActionRow]}>
                    <Button mode="text" onPress={() => onRename(participant)}>
                      {t("common.edit")}
                    </Button>
                    <Button mode="text" onPress={() => onCreateInvite(participant.id)}>
                      {t("invite.targeted")}
                    </Button>
                    {canRemoveParticipant(participant, currentParticipantId) ? (
                      <Button mode="text" textColor={dangerColor} onPress={() => onRemove(participant)}>
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
                removable={canRemoveParticipant(participant, currentParticipantId)}
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
  onPress
}: Readonly<{
  friend: Friend;
  description: string;
  onPress: () => void;
}>) {
  return (
    <List.Item
      style={styles.listItemDense}
      title={friend.display_name}
      description={description}
      left={renderPersonAvatar(friend.display_name, friend.avatar_url)}
      right={renderListIcon("account-plus")}
      onPress={onPress}
    />
  );
}

function RegisteredParticipantItem({
  participant,
  description,
  dangerColor,
  deleteLabel,
  removable,
  onRemove
}: Readonly<{
  participant: Participant;
  description: string;
  dangerColor: string;
  deleteLabel: string;
  removable: boolean;
  onRemove: () => void;
}>) {
  return (
    <List.Item
      title={participant.display_name}
      description={description}
      left={renderClickableAvatar(participant.display_name, participant.avatar_url)}
      right={renderDeleteAction(removable, dangerColor, deleteLabel, onRemove)}
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

function renderDeleteAction(
  removable: boolean,
  dangerColor: string,
  deleteLabel: string,
  onRemove: () => void
) {
  return function DeleteActionRenderer() {
    if (!removable) return null;
    return (
      <Button mode="text" textColor={dangerColor} onPress={onRemove}>
        {deleteLabel}
      </Button>
    );
  };
}

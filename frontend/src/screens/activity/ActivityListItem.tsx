import { StyleProp, View, ViewStyle } from "react-native";
import { Card, List, Text, TouchableRipple } from "react-native-paper";

import { useI18n } from "../../shared/i18n/I18nContext";
import { formatDeviceDate } from "../../shared/lib/dates";
import { ActivityFeedEvent } from "../../shared/types/models";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { styles } from "../../shared/ui/styles";
import {
  ACTIVITY_TITLE_NUMBER_OF_LINES,
  activityContext,
  activityDescription,
  activityIcon
} from "./activityHelpers";

type ActivityListItemProps = {
  item: ActivityFeedEvent;
  onPress: () => void;
};

type ActivityActorAvatarProps = {
  actorName: string;
  imageUrl?: string;
};

function ActivityActorAvatar({ actorName, imageUrl }: Readonly<ActivityActorAvatarProps>) {
  return <PersonAvatar name={actorName} imageUrl={imageUrl} />;
}

type ActivityListItemMetaProps = {
  createdAt: string;
  eventType: ActivityFeedEvent["event_type"];
  style?: StyleProp<ViewStyle>;
};

function ActivityListItemMeta({ createdAt, eventType, style }: Readonly<ActivityListItemMetaProps>) {
  return (
    <View style={[style, styles.listTileRight]}>
      <List.Icon icon={activityIcon(eventType)} />
      <Text variant="bodySmall">{formatDeviceDate(createdAt)}</Text>
    </View>
  );
}

/** A single entry in the activity feed. */
export function ActivityListItem({ item, onPress }: Readonly<ActivityListItemProps>) {
  const { t } = useI18n();
  const description = activityDescription(item, t);
  const context = activityContext(item, t);
  const pendingStatus = item.pending_mutation_id ? t("expense.pendingSync") : "";
  // Empty actor means the acting user deleted their account.
  const actorName = item.actor || t("activity.deletedUser");
  return (
    <Card mode="elevated" style={styles.card}>
      <TouchableRipple disabled={!item.expense_id && !item.settlement_id} onPress={onPress}>
        <Card.Content>
          <List.Item
            style={styles.listTile}
            titleNumberOfLines={ACTIVITY_TITLE_NUMBER_OF_LINES}
            descriptionNumberOfLines={ACTIVITY_TITLE_NUMBER_OF_LINES}
            title={t(`activity.${item.event_type}`, { actor: actorName })}
            description={[context, description, pendingStatus].filter(Boolean).join("\n")}
            left={() => <ActivityActorAvatar actorName={actorName} imageUrl={item.actor_avatar_url} />}
            right={({ style }) => (
              <ActivityListItemMeta createdAt={item.created_at} eventType={item.event_type} style={style} />
            )}
          />
        </Card.Content>
      </TouchableRipple>
    </Card>
  );
}

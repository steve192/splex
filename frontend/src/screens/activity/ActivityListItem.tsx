import { View } from "react-native";
import { Card, List, Text, TouchableRipple } from "react-native-paper";

import { useI18n } from "../../shared/i18n/I18nContext";
import { formatDeviceDate } from "../../shared/lib/dates";
import { ActivityFeedEvent } from "../../shared/types/models";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { styles } from "../../shared/ui/styles";
import { activityContext, activityDescription, activityIcon } from "./activityHelpers";

type ActivityListItemProps = {
  item: ActivityFeedEvent;
  onPress: () => void;
};

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
            title={t(`activity.${item.event_type}`, { actor: actorName })}
            description={[context, description, pendingStatus].filter(Boolean).join("\n")}
            left={() => <PersonAvatar name={actorName} imageUrl={item.actor_avatar_url} />}
            right={() => (
              <View style={styles.listTileRight}>
                <List.Icon icon={activityIcon(item.event_type)} />
                <Text variant="bodySmall">{formatDeviceDate(item.created_at)}</Text>
              </View>
            )}
          />
        </Card.Content>
      </TouchableRipple>
    </Card>
  );
}

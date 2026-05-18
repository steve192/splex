import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Card, List, Text, TouchableRipple } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { ActivityStackParamList } from "../../application/navigationTypes";
import { appImages } from "../../shared/assets/images";
import { useI18n } from "../../shared/i18n/I18nContext";
import { formatDeviceDate } from "../../shared/lib/dates";
import { EmptyState } from "../../shared/ui/EmptyState";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

type ActivityEvent = {
  id: number;
  event_type: string;
  actor: string;
  actor_avatar_url?: string;
  payload?: Record<string, string | number | undefined>;
  created_at: string;
  context_type?: "group" | "friend" | "";
  context_name?: string;
  expense_id?: number | null;
  settlement_id?: number | null;
};

function activityDescription(item: ActivityEvent): string {
  const payload = item.payload ?? {};
  if (payload.description && payload.amount && payload.currency) {
    return `${payload.description} - ${payload.amount} ${payload.currency}`;
  }
  if (payload.description) return String(payload.description);
  if (payload.groupName && payload.participantName) return `${payload.participantName} - ${payload.groupName}`;
  if (payload.groupName) return String(payload.groupName);
  if (payload.friendName) return String(payload.friendName);
  if (payload.amount && payload.currency) return `${payload.amount} ${payload.currency}`;
  return "";
}

function activityContext(item: ActivityEvent, t: (key: string, values?: Record<string, string | number>) => string): string {
  if (!item.context_name) return "";
  if (item.context_type === "group") {
    return `${t("group.title")}: ${item.context_name}`;
  }
  if (item.context_type === "friend") {
    return `${t("friend.title")}: ${item.context_name}`;
  }
  return item.context_name;
}

function activityIcon(eventType: string): string {
  if (eventType.startsWith("expense.")) return "receipt";
  if (eventType.startsWith("settlement.")) return "cash-check";
  if (eventType.startsWith("friend.")) return "account";
  if (eventType.startsWith("group.")) return "account-group";
  return "history";
}

type ActivityScreenProps = NativeStackScreenProps<ActivityStackParamList, "ActivityHome">;

export function ActivityScreen({ navigation }: ActivityScreenProps) {
  const { t } = useI18n();
  const { api } = useAuth();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);

  async function load(offset = 0) {
    if (loading) return;
    setLoading(true);
    try {
      const response = await api.get<{ results: ActivityEvent[]; next_offset: number | null }>(
        `/api/activity/?offset=${offset}&limit=50`
      );
      setEvents((current) => (offset ? [...current, ...response.results] : response.results));
      setNextOffset(response.next_offset);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(0).catch(() => undefined);
  }, []);

  function openActivityItem(item: ActivityEvent) {
    if (item.expense_id) {
      navigation.navigate("ExpenseDetail", { id: item.expense_id });
      return;
    }
    if (item.settlement_id) {
      navigation.navigate("SettlementDetail", { id: item.settlement_id });
    }
  }

  return (
    <Screen>
      <Text variant="headlineSmall">{t("tabs.activity")}</Text>
      {!events.length ? <EmptyState image={appImages.emptyActivity} text={t("activity.empty")} /> : null}
      {events.map((item) => {
        const description = activityDescription(item);
        const context = activityContext(item, t);
        return (
          <Card key={String(item.id)} mode="elevated" style={styles.card}>
            <TouchableRipple
              disabled={!item.expense_id && !item.settlement_id}
              onPress={() => openActivityItem(item)}
            >
              <Card.Content>
                <List.Item
                  style={styles.listTile}
                  title={t(`activity.${item.event_type}`)}
                  description={[context, description].filter(Boolean).join("\n")}
                  left={() => <PersonAvatar name={item.actor} imageUrl={item.actor_avatar_url} />}
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
      })}
      {nextOffset !== null ? (
        <Button mode="elevated" loading={loading} onPress={() => load(nextOffset)}>
          {t("activity.loadMore")}
        </Button>
      ) : null}
    </Screen>
  );
}

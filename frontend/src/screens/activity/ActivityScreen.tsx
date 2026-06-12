import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, View } from "react-native";
import { Button, Card, List, Text, TouchableRipple } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { ActivityStackParamList } from "../../application/navigationTypes";
import { appImages } from "../../shared/assets/images";
import { useI18n } from "../../shared/i18n/I18nContext";
import { listPendingExpenses } from "../../shared/ledger/pendingExpenses";
import { formatDeviceDate } from "../../shared/lib/dates";
import { cachedGet, readCachedResponse } from "../../shared/lib/offlineCache";
import { ActivityFeedEvent, Friend, Group } from "../../shared/types/models";
import { EmptyState } from "../../shared/ui/EmptyState";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";
import { activityContext, activityDescription, activityIcon } from "./activityHelpers";

type ActivityScreenProps = NativeStackScreenProps<ActivityStackParamList, "ActivityHome">;

export function ActivityScreen({ navigation }: Readonly<ActivityScreenProps>) {
  const { t } = useI18n();
  const { api } = useAuth();
  const [events, setEvents] = useState<ActivityFeedEvent[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);

  async function withPendingEvents(remoteEvents: ActivityFeedEvent[]): Promise<ActivityFeedEvent[]> {
    const [pendingExpenses, groups, friends] = await Promise.all([
      listPendingExpenses(),
      readCachedResponse<Group[]>("/api/groups/"),
      readCachedResponse<Friend[]>("/api/friends/")
    ]);
    const pendingEvents = pendingExpenses.map<ActivityFeedEvent>((draft) => ({
      id: `pending-${draft.mutationId}`,
      event_type: "expense.created",
      actor: t("common.you"),
      created_at: draft.createdAt,
      context_type: draft.contextType === "group" ? "group" : "friend",
      context_name:
        draft.contextType === "group"
          ? groups?.find((group) => group.id === draft.contextId)?.name
          : friends?.find((friend) => friend.id === draft.contextId)?.display_name,
      pending_mutation_id: draft.mutationId,
      payload: {
        description: draft.description,
        amount: draft.amount,
        currency: draft.currency,
        syncStatus: t("expense.pendingSync")
      }
    }));

    return [...pendingEvents, ...remoteEvents].sort((left, right) => right.created_at.localeCompare(left.created_at));
  }

  async function load(offset = 0) {
    if (loading) return;
    setLoading(true);
    try {
      const path = `/api/activity/?offset=${offset}&limit=50`;
      const response = offset
        ? await api.get<{ results: ActivityFeedEvent[]; next_offset: number | null }>(path)
        : await cachedGet<{ results: ActivityFeedEvent[]; next_offset: number | null }>(api, path);
      if (offset) {
        setEvents((current) => [...current, ...response.results]);
      } else {
        setEvents(await withPendingEvents(response.results));
      }
      setNextOffset(response.next_offset);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load(0).catch(() => undefined);
    }, [])
  );

  function openActivityItem(item: ActivityFeedEvent) {
    if (item.pending_mutation_id) {
      navigation.navigate("AddExpense", { pendingMutationId: item.pending_mutation_id, returnToPrevious: true });
      return;
    }
    if (item.expense_id) {
      navigation.navigate("ExpenseDetail", { id: item.expense_id });
      return;
    }
    if (item.settlement_id) {
      navigation.navigate("SettlementDetail", { id: item.settlement_id });
    }
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (loading || nextOffset === null) return;
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const remaining = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (remaining < 320) {
      load(nextOffset).catch(() => undefined);
    }
  }

  return (
    <Screen topInset scrollViewProps={{ onScroll: handleScroll }}>
      <Text variant="headlineSmall">{t("tabs.activity")}</Text>
      {!events.length && <EmptyState image={appImages.emptyActivity} text={t("activity.empty")} />}
      {events.map((item) => {
        const description = activityDescription(item, t);
        const context = activityContext(item, t);
        const pendingStatus = item.pending_mutation_id ? t("expense.pendingSync") : "";
        // Empty actor means the acting user deleted their account.
        const actorName = item.actor || t("activity.deletedUser");
        return (
          <Card key={String(item.id)} mode="elevated" style={styles.card}>
            <TouchableRipple
              disabled={!item.expense_id && !item.settlement_id}
              onPress={() => openActivityItem(item)}
            >
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
      })}
      {nextOffset !== null && (
        <Button mode="elevated" loading={loading} onPress={() => load(nextOffset)}>
          {t("activity.loadMore")}
        </Button>
      )}
    </Screen>
  );
}

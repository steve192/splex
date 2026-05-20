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
import { loadCachedActivityEvents, loadCachedFriends, loadCachedGroups, saveCachedActivityEvents } from "../../shared/lib/offlineCache";
import { ActivityFeedEvent } from "../../shared/types/models";
import { EmptyState } from "../../shared/ui/EmptyState";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

function activityDescription(item: ActivityFeedEvent): string {
  const payload = item.payload ?? {};
  if (payload.description && payload.amount && payload.currency) {
    return `${payload.description} - ${payload.amount} ${payload.currency}`;
  }
  if (payload.description) return String(payload.description);
  // Prefer the live subject_name from the API; fall back to legacy snapshot
  // keys so events recorded before the rename refactor still render.
  const subject = item.subject_name || payload.participantName || payload.friendName;
  if (subject) return String(subject);
  if (payload.amount && payload.currency) return `${payload.amount} ${payload.currency}`;
  return "";
}

function activityContext(item: ActivityFeedEvent, t: (key: string, values?: Record<string, string | number>) => string): string {
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
  const [events, setEvents] = useState<ActivityFeedEvent[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);

  async function withPendingEvents(remoteEvents: ActivityFeedEvent[]): Promise<ActivityFeedEvent[]> {
    const [pendingExpenses, groups, friends] = await Promise.all([
      listPendingExpenses(),
      loadCachedGroups(),
      loadCachedFriends()
    ]);
    const pendingEvents = pendingExpenses.map<ActivityFeedEvent>((draft) => ({
      id: `pending-${draft.mutationId}`,
      event_type: "expense.created",
      actor: t("common.you"),
      created_at: draft.createdAt,
      context_type: draft.contextType === "group" ? "group" : "friend",
      context_name:
        draft.contextType === "group"
          ? groups.find((group) => group.id === draft.contextId)?.name
          : friends.find((friend) => friend.id === draft.contextId)?.display_name,
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
      const response = await api.get<{ results: ActivityFeedEvent[]; next_offset: number | null }>(
        `/api/activity/?offset=${offset}&limit=50`
      );
      if (offset) {
        setEvents((current) => [...current, ...response.results]);
      } else {
        setEvents(await withPendingEvents(response.results));
        await saveCachedActivityEvents(response.results);
      }
      setNextOffset(response.next_offset);
    } catch {
      if (!offset) {
        setEvents(await withPendingEvents(await loadCachedActivityEvents()));
        setNextOffset(null);
      }
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
      {!events.length ? <EmptyState image={appImages.emptyActivity} text={t("activity.empty")} /> : null}
      {events.map((item) => {
        const description = activityDescription(item);
        const context = activityContext(item, t);
        const pendingStatus = item.pending_mutation_id ? t("expense.pendingSync") : "";
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
                  description={[context, description, pendingStatus].filter(Boolean).join("\n")}
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

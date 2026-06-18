import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback } from "react";
import { View } from "react-native";
import { Button, IconButton, Text } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { ActivityStackParamList } from "../../application/navigationTypes";
import { appImages } from "../../shared/assets/images";
import { useI18n } from "../../shared/i18n/I18nContext";
import { listPendingExpenses } from "../../shared/ledger/pendingExpenses";
import { useInfiniteScroll } from "../../shared/ledger/useInfiniteScroll";
import { useListSearch } from "../../shared/lib/useListSearch";
import { usePaginatedFeed } from "../../shared/lib/usePaginatedFeed";
import { cachedGet, readCachedResponse } from "../../shared/lib/offlineCache";
import { ActivityFeedEvent, Friend, Group } from "../../shared/types/models";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ListSearchbar } from "../../shared/ui/ListSearchbar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";
import { ActivityListItem } from "./ActivityListItem";

type ActivityScreenProps = NativeStackScreenProps<ActivityStackParamList, "ActivityHome">;

const ACTIVITY_PAGE_SIZE = 50;

export function ActivityScreen({ navigation }: Readonly<ActivityScreenProps>) {
  const { t } = useI18n();
  const { api } = useAuth();
  const search = useListSearch();

  // Prepend not-yet-synced drafts as activity rows so they show up immediately.
  const withPendingEvents = useCallback(
    async (remoteEvents: ActivityFeedEvent[]): Promise<ActivityFeedEvent[]> => {
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
      return [...pendingEvents, ...remoteEvents].sort((left, right) =>
        right.created_at.localeCompare(left.created_at)
      );
    },
    [t]
  );

  const { items, nextOffset, loadingMore, load, refresh } = usePaginatedFeed<ActivityFeedEvent>({
    pageSize: ACTIVITY_PAGE_SIZE,
    searchTerm: search.term,
    mapInitial: withPendingEvents,
    fetchPage: async ({ offset, limit, search: term, cacheable }) => {
      const searchQuery = term ? `&search=${encodeURIComponent(term)}` : "";
      const path = `/api/activity/?offset=${offset}&limit=${limit}${searchQuery}`;
      const response = cacheable
        ? await cachedGet<{ results: ActivityFeedEvent[]; next_offset: number | null }>(api, path)
        : await api.get<{ results: ActivityFeedEvent[]; next_offset: number | null }>(path);
      return { items: response.results, nextOffset: response.next_offset };
    }
  });

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => undefined);
    }, [refresh])
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

  const handleScroll = useInfiniteScroll({
    loadingMore,
    nextOffset,
    onLoadMore: (offset) => load(offset).catch(() => undefined)
  });

  return (
    <Screen topInset scrollViewProps={{ onScroll: handleScroll }}>
      {search.active ? (
        <ListSearchbar value={search.input} onChangeText={search.setInput} onClose={search.close} />
      ) : (
        <View style={styles.rowBetween}>
          <Text variant="headlineSmall">{t("tabs.activity")}</Text>
          <IconButton icon="magnify" onPress={search.open} accessibilityLabel={t("common.search")} />
        </View>
      )}
      {!items.length && (
        <EmptyState
          image={appImages.emptyActivity}
          text={search.term ? t("common.noResults") : t("activity.empty")}
        />
      )}
      {items.map((item) => (
        <ActivityListItem key={String(item.id)} item={item} onPress={() => openActivityItem(item)} />
      ))}
      {nextOffset !== null && (
        <Button mode="elevated" loading={loadingMore} onPress={() => load(nextOffset)}>
          {t("activity.loadMore")}
        </Button>
      )}
    </Screen>
  );
}

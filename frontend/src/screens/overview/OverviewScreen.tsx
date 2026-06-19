import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  List,
  Text,
  TouchableRipple,
} from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { OverviewStackParamList } from "../../application/navigationTypes";
import { useSnackbar } from "../../shared/feedback/SnackbarContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { appImages } from "../../shared/assets/images";
import { apiWriteErrorMessage } from "../../shared/lib/apiErrors";
import { shareLink } from "../../shared/lib/shareLink";
import { usePendingAction } from "../../shared/lib/usePendingAction";
import {
  countPendingExpensesByContext,
  pendingExpenseContextKey,
} from "../../shared/ledger/pendingExpenses";
import { useCachedQuery } from "../../shared/lib/useCachedQuery";
import { Friend, Group, OverviewItem } from "../../shared/types/models";
import { BalanceStack } from "../../shared/ui/BalanceStack";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ManualCopyDialog } from "../../shared/ui/ManualCopyDialog";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";
import { overviewItemsFromRows } from "./overviewItems";

type OverviewScreenProps = NativeStackScreenProps<
  OverviewStackParamList,
  "OverviewHome"
>;

export function OverviewScreen({ navigation }: Readonly<OverviewScreenProps>) {
  const { t } = useI18n();
  const { api } = useAuth();
  const { showSnackbar } = useSnackbar();
  const { hasPending, isPending, runPendingAction } =
    usePendingAction<"friend-invite">();
  const [manualCopyLink, setManualCopyLink] = useState("");
  const overviewQuery = useCachedQuery({
    load: useCallback(
      async ({ cachedGet: getCached }) => {
        const [groupRows, friendRows, pendingCounts] = await Promise.all([
          getCached<Group[]>(api, "/api/groups/"),
          getCached<Friend[]>(api, "/api/friends/"),
          countPendingExpensesByContext(),
        ]);
        return {
          items: overviewItemsFromRows(groupRows, friendRows),
          pendingCounts,
        };
      },
      [api],
    ),
  });
  const items = overviewQuery.data?.items ?? [];
  const pendingCounts = overviewQuery.data?.pendingCounts ?? {};
  const groups = items.filter(
    (item) => item.type === "group" && !item.archived_at,
  );
  const friends = items.filter(
    (item) => item.type === "friend" && !item.archived_at,
  );
  const archivedItems = items.filter((item) => item.archived_at);
  const [showArchived, setShowArchived] = useState(false);

  useFocusEffect(
    useCallback(() => {
      overviewQuery.reload().catch(() => undefined);
    }, [overviewQuery.reload]),
  );

  async function createFriendInvite() {
    await runPendingAction("friend-invite", async () => {
      let invitation: { url: string };
      try {
        invitation = await api.post<{ url: string }>(
          "/api/friends/invitations/",
        );
      } catch (error) {
        showSnackbar(apiWriteErrorMessage(error, t));
        return;
      }
      const result = await shareLink(invitation.url, {
        title: t("invite.shareTitle"),
      });
      if (result === "copied") {
        showSnackbar(t("invite.copied"), { duration: 8000 });
      } else if (result === "failed") {
        setManualCopyLink(invitation.url);
      }
    });
  }

  function renderItem(item: OverviewItem) {
    const pendingCount =
      pendingCounts[
        pendingExpenseContextKey(
          item.type === "group" ? "group" : "friendship",
          item.id,
        )
      ] ?? 0;
    const descriptionParts = [
      `${item.type === "group" ? t("group.title") : t("friend.title")} - ${item.currency}`,
    ];
    if (pendingCount) {
      descriptionParts.push(
        t("expense.pendingSyncCount", { count: pendingCount }),
      );
    }

    return (
      <Card key={`${item.type}-${item.id}`} style={styles.card} mode="elevated">
        <TouchableRipple
          style={styles.clickable}
          onPress={() =>
            navigation.navigate(
              item.type === "group" ? "GroupDetail" : "FriendDetail",
              { id: item.id },
            )
          }
        >
          <Card.Content>
            <List.Item
              style={styles.listTile}
              title={item.name}
              description={descriptionParts.join(" • ")}
              left={(props) =>
                item.type === "group" ? (
                  <PersonAvatar name={item.name} imageUrl={item.icon_url} />
                ) : (
                  <PersonAvatar name={item.name} imageUrl={item.avatar_url} />
                )
              }
              right={() => (
                <View style={styles.listTileRight}>
                  <BalanceStack
                    amount={item.balance}
                    currency={item.currency}
                  />
                </View>
              )}
            />
          </Card.Content>
        </TouchableRipple>
      </Card>
    );
  }

  return (
    <View style={styles.flex}>
      <Screen topInset>
        <View style={styles.inline}>
          <Text variant="headlineSmall">{t("tabs.overview")}</Text>
          {overviewQuery.loading && <ActivityIndicator size={16} />}
        </View>
        <View style={styles.rowActions}>
          <Button
            mode="contained"
            icon="account-group"
            onPress={() => navigation.navigate("CreateGroup")}
          >
            {t("group.create")}
          </Button>
          <Button
            mode="elevated"
            icon="link-variant"
            loading={isPending("friend-invite")}
            disabled={hasPending}
            onPress={createFriendInvite}
          >
            {t("friend.invite")}
          </Button>
        </View>
        {!items.length && !overviewQuery.loadingInitial && (
          <EmptyState
            image={appImages.emptyGroupsFriends}
            text={t("overview.empty")}
          />
        )}
        {!overviewQuery.loadingInitial && (
          <View style={styles.listSection}>
            <Text variant="titleLarge">{t("overview.groups")}</Text>
            {groups.length ? (
              groups.map(renderItem)
            ) : (
              <Text variant="bodyMedium">{t("overview.noGroups")}</Text>
            )}
          </View>
        )}
        {!overviewQuery.loadingInitial && archivedItems.length ? (
          <View style={styles.listSection}>
            <List.Accordion
              title={t("overview.archived")}
              expanded={showArchived}
              onPress={() => setShowArchived((current) => !current)}
            >
              {archivedItems.map(renderItem)}
            </List.Accordion>
          </View>
        ) : null}
        {!overviewQuery.loadingInitial && (
          <View style={styles.listSection}>
            <Text variant="titleLarge">{t("overview.friends")}</Text>
            {friends.length ? (
              friends.map(renderItem)
            ) : (
              <Text variant="bodyMedium">{t("overview.noFriends")}</Text>
            )}
          </View>
        )}
      </Screen>
      <ManualCopyDialog
        visible={!!manualCopyLink}
        title={t("invite.copyManual")}
        description={t("invite.copyManualHelp")}
        value={manualCopyLink}
        label={t("invite.copyLabel")}
        onDismiss={() => setManualCopyLink("")}
      />
    </View>
  );
}

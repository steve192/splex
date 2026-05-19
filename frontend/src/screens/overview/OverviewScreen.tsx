import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Card, List, Snackbar, Text, TouchableRipple } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { OverviewStackParamList } from "../../application/navigationTypes";
import { useI18n } from "../../shared/i18n/I18nContext";
import { appImages, defaultGroupAvatar } from "../../shared/assets/images";
import { copyTextToClipboard } from "../../shared/lib/clipboard";
import { countPendingExpensesByContext, pendingExpenseContextKey } from "../../shared/ledger/pendingExpenses";
import { loadCachedFriends, loadCachedOverviewItems, saveCachedFriends, saveCachedOverviewItems } from "../../shared/lib/offlineCache";
import { Friend, OverviewItem } from "../../shared/types/models";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ManualCopyDialog } from "../../shared/ui/ManualCopyDialog";
import { MoneyText } from "../../shared/ui/MoneyText";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

type OverviewScreenProps = NativeStackScreenProps<OverviewStackParamList, "OverviewHome">;

export function OverviewScreen({ navigation }: OverviewScreenProps) {
  const { t } = useI18n();
  const { api } = useAuth();
  const [items, setItems] = useState<OverviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState("");
  const [manualCopyLink, setManualCopyLink] = useState("");
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  const groups = items.filter((item) => item.type === "group" && !item.archived_at);
  const archivedGroups = items.filter((item) => item.type === "group" && item.archived_at);
  const friends = items.filter((item) => item.type === "friend");
  const [showArchived, setShowArchived] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [overview, friends] = await Promise.all([
        api.get<{ items: OverviewItem[] }>("/api/overview/"),
        api.get<Friend[]>("/api/friends/")
      ]);
      const nextItems = [
        ...overview.items,
        ...friends.map((friend) => ({
          type: "friend" as const,
          id: friend.id,
          name: friend.display_name,
          avatar_url: friend.avatar_url,
          currency: friend.default_currency,
          balance: friend.balance
        }))
      ];
      setItems(nextItems);
      await Promise.all([saveCachedOverviewItems(overview.items), saveCachedFriends(friends)]);
    } catch {
      const [cachedOverview, cachedFriends] = await Promise.all([loadCachedOverviewItems(), loadCachedFriends()]);
      setItems([
        ...cachedOverview,
        ...cachedFriends.map((friend) => ({
          type: "friend" as const,
          id: friend.id,
          name: friend.display_name,
          avatar_url: friend.avatar_url,
          currency: friend.default_currency,
          balance: friend.balance
        }))
      ]);
    } finally {
      setPendingCounts(await countPendingExpensesByContext());
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [])
  );

  async function createFriendInvite() {
    const invitation = await api.post<{ url: string }>("/api/friends/invitations/");
    if (await copyTextToClipboard(invitation.url)) {
      setSnackbar(t("invite.copied"));
      return;
    }
    setManualCopyLink(invitation.url);
  }

  function renderItem(item: OverviewItem) {
    const pendingCount =
      pendingCounts[
        pendingExpenseContextKey(item.type === "group" ? "group" : "friendship", item.id)
      ] ?? 0;
    const descriptionParts = [`${item.type === "group" ? t("group.title") : t("friend.title")} - ${item.currency}`];
    if (pendingCount) {
      descriptionParts.push(t("expense.pendingSyncCount", { count: pendingCount }));
    }

    return (
      <Card key={`${item.type}-${item.id}`} style={styles.card} mode="elevated">
        <TouchableRipple
          style={styles.clickable}
          onPress={() =>
            navigation.navigate(item.type === "group" ? "GroupDetail" : "FriendDetail", { id: item.id })
          }
        >
          <Card.Content>
            <List.Item
              style={styles.listTile}
              title={item.name}
              description={descriptionParts.join(" • ")}
              left={(props) =>
                item.type === "group" ? (
                  <PersonAvatar
                    name={item.name}
                    imageUrl={item.icon_url}
                    imageSource={defaultGroupAvatar(item.name)}
                  />
                ) : (
                  <PersonAvatar name={item.name} imageUrl={item.avatar_url} />
                )
              }
              right={() => (
                <View style={styles.listTileRight}>
                  <MoneyText variant="bodyMedium" amount={item.balance} currency={item.currency} />
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
        <Text variant="headlineSmall">{t("tabs.overview")}</Text>
        <View style={styles.rowActions}>
          <Button mode="contained" icon="account-group" loading={loading} onPress={() => navigation.navigate("CreateGroup")}>
            {t("group.create")}
          </Button>
          <Button mode="elevated" icon="link-variant" onPress={createFriendInvite}>
            {t("friend.invite")}
          </Button>
        </View>
        {!items.length ? <EmptyState image={appImages.emptyGroupsFriends} text={t("overview.empty")} /> : null}
        <View style={styles.listSection}>
          <Text variant="titleLarge">{t("overview.groups")}</Text>
          {groups.length ? groups.map(renderItem) : <Text variant="bodyMedium">{t("overview.noGroups")}</Text>}
        </View>
        {archivedGroups.length ? (
          <View style={styles.listSection}>
            <List.Accordion
              title={t("overview.archived")}
              expanded={showArchived}
              onPress={() => setShowArchived((current) => !current)}
            >
              {archivedGroups.map(renderItem)}
            </List.Accordion>
          </View>
        ) : null}
        <View style={styles.listSection}>
          <Text variant="titleLarge">{t("overview.friends")}</Text>
          {friends.length ? friends.map(renderItem) : <Text variant="bodyMedium">{t("overview.noFriends")}</Text>}
        </View>
      </Screen>
      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar("")} duration={8000}>
        {snackbar}
      </Snackbar>
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

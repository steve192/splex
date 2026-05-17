import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, Card, List, Snackbar, Text, TouchableRipple } from "react-native-paper";

import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../../shared/i18n/I18nContext";
import { Friend, OverviewItem } from "../../shared/types/models";
import { EmptyState } from "../../shared/ui/EmptyState";
import { MoneyText } from "../../shared/ui/MoneyText";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

export function OverviewScreen({ navigation }: any) {
  const { t } = useI18n();
  const { api } = useAuth();
  const [items, setItems] = useState<OverviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState("");
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
      setItems([
        ...overview.items,
        ...friends.map((friend) => ({
          type: "friend" as const,
          id: friend.id,
          name: friend.display_name,
          avatar_url: friend.avatar_url,
          currency: friend.currency,
          balance: friend.balance
        }))
      ]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => load().catch(() => undefined));
    return unsubscribe;
  }, [navigation]);

  async function createFriendInvite() {
    const invitation = await api.post<{ url: string }>("/api/friends/invitations/");
    setSnackbar(invitation.url);
  }

  function renderItem(item: OverviewItem) {
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
              description={`${item.type === "group" ? t("group.title") : t("friend.title")} - ${item.currency}`}
              left={(props) =>
                item.type === "group" ? (
                  <PersonAvatar name={item.name} imageUrl={item.icon_url} />
                ) : (
                  <PersonAvatar name={item.name} imageUrl={item.avatar_url} />
                )
              }
              right={() => (
                <View style={styles.listTileRight}>
                  <MoneyText variant="bodyMedium" amount={item.balance} currency={item.currency} t={t} />
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
      <Screen>
          <Text variant="headlineSmall">{t("tabs.overview")}</Text>
          <View style={styles.rowActions}>
            <Button mode="contained" icon="account-group" loading={loading} onPress={() => navigation.navigate("CreateGroup")}>
              {t("group.create")}
            </Button>
            <Button mode="elevated" icon="link-variant" onPress={createFriendInvite}>
              {t("friend.invite")}
            </Button>
          </View>
        {!items.length ? <EmptyState text={t("overview.empty")} /> : null}
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
    </View>
  );
}

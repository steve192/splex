import { ReactNode } from "react";
import { View } from "react-native";
import { Card, HelperText, List, Searchbar, Text, TouchableRipple } from "react-native-paper";

import { ContextOption, Friend, Group } from "../../shared/types/models";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { Screen } from "../../shared/ui/Screen";
import { styles } from "../../shared/ui/styles";

type ContextPickerStepProps = {
  groups: Group[];
  friends: Friend[];
  query: string;
  t: (key: string) => string;
  onQueryChange: (value: string) => void;
  onSelect: (option: ContextOption) => void;
};

export function ContextPickerStep({
  groups,
  friends,
  query,
  t,
  onQueryChange,
  onSelect
}: ContextPickerStepProps) {
  const filteredGroups = filterByQuery(groups, query, (group) => group.name);
  const filteredFriends = filterByQuery(friends, query, (friend) => friend.display_name);

  return (
    <Screen>
      <Text variant="headlineSmall">{t("expense.add")}</Text>
      <Searchbar value={query} onChangeText={onQueryChange} placeholder={t("expense.searchContext")} />
      <ContextSection title={t("overview.groups")} emptyText={t("overview.noGroups")}>
        {filteredGroups.map((group) => (
          <ContextRow
            key={group.id}
            title={group.name}
            description={group.default_currency}
            imageUrl={group.icon_url}
            onPress={() =>
              onSelect({
                type: "group",
                id: group.id,
                name: group.name,
                currency: group.default_currency,
                image_url: group.icon_url
              })
            }
          />
        ))}
      </ContextSection>
      <ContextSection title={t("overview.friends")} emptyText={t("overview.noFriends")}>
        {filteredFriends.map((friend) => (
          <ContextRow
            key={friend.id}
            title={friend.display_name}
            description={friend.currency}
            imageUrl={friend.avatar_url}
            onPress={() =>
              onSelect({
                type: "friendship",
                id: friend.id,
                name: friend.display_name,
                currency: friend.currency,
                image_url: friend.avatar_url
              })
            }
          />
        ))}
      </ContextSection>
      {!groups.length && !friends.length ? <HelperText type="info">{t("expense.noContexts")}</HelperText> : null}
    </Screen>
  );
}

function filterByQuery<T>(items: T[], query: string, label: (item: T) => string): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => label(item).toLowerCase().includes(normalized));
}

function ContextSection({
  title,
  emptyText,
  children
}: {
  title: string;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.gap}>
      <Text variant="titleLarge">{title}</Text>
      {Array.isArray(children) && children.length === 0 ? <Text variant="bodyMedium">{emptyText}</Text> : children}
    </View>
  );
}

function ContextRow({
  title,
  description,
  imageUrl,
  onPress
}: {
  title: string;
  description: string;
  imageUrl?: string;
  onPress: () => void;
}) {
  return (
    <Card mode="elevated" style={styles.card}>
      <TouchableRipple style={styles.clickable} onPress={onPress}>
        <Card.Content>
          <List.Item
            style={styles.listTile}
            title={title}
            description={description}
            left={() => <PersonAvatar name={title} imageUrl={imageUrl} />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
          />
        </Card.Content>
      </TouchableRipple>
    </Card>
  );
}

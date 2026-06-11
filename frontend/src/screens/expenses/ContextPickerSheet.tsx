import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Checkbox, Divider, List, Modal, Portal, Searchbar, Text, TouchableRipple, useTheme } from "react-native-paper";

import { useI18n } from "../../shared/i18n/I18nContext";
import { useKeyboardHeight } from "../../shared/lib/useKeyboardHeight";
import { ContextOption, Friend, Group } from "../../shared/types/models";
import { ContentWidth } from "../../shared/ui/ContentWidth";
import { PersonAvatar } from "../../shared/ui/PersonAvatar";
import { styles } from "../../shared/ui/styles";

type ContextPickerSheetProps = {
  visible: boolean;
  groups: Group[];
  friends: Friend[];
  onSelect: (option: ContextOption) => void;
  onDismiss: () => void;
  showRemember?: boolean;
  remember?: boolean;
  onToggleRemember?: () => void;
};

export function ContextPickerSheet({
  visible,
  groups,
  friends,
  onSelect,
  onDismiss,
  showRemember = false,
  remember = false,
  onToggleRemember
}: Readonly<ContextPickerSheetProps>) {
  const { t } = useI18n();
  const theme = useTheme();
  const keyboardHeight = useKeyboardHeight();
  const [query, setQuery] = useState("");

  const filteredGroups = useMemo(() => filterByQuery(groups, query, (group) => group.name), [groups, query]);
  const filteredFriends = useMemo(
    () => filterByQuery(friends, query, (friend) => friend.display_name),
    [friends, query]
  );

  function pick(option: ContextOption) {
    onSelect(option);
    setQuery("");
    onDismiss();
  }

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.bottomSheet, { backgroundColor: theme.colors.surface }]}
        style={[styles.bottomSheetWrapper, { marginBottom: keyboardHeight }]}
      >
        <ContentWidth>
          <View style={[styles.bottomSheetHandle, { backgroundColor: theme.colors.outlineVariant }]} />
          <View style={styles.rowBetween}>
            <Text variant="titleLarge">{t("expense.context")}</Text>
            <Button onPress={onDismiss}>{t("common.cancel")}</Button>
          </View>
          {showRemember ? (
            <TouchableRipple onPress={onToggleRemember} style={styles.optionRow}>
              <View style={styles.inline}>
                <Checkbox.Android status={remember ? "checked" : "unchecked"} />
                <Text variant="bodyMedium">{t("expense.rememberContext")}</Text>
              </View>
            </TouchableRipple>
          ) : null}
          <Searchbar
            value={query}
            onChangeText={setQuery}
            placeholder={t("expense.searchContext")}
            style={styles.searchbarInSheet}
          />
          <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled">
            {!groups.length && !friends.length ? (
              <Text variant="bodyMedium">{t("expense.noContexts")}</Text>
            ) : (
              <>
                <Section title={t("overview.groups")} emptyText={t("overview.noGroups")} items={filteredGroups}>
                  {filteredGroups.map((group) => (
                    <ContextRow
                      key={`g-${group.id}`}
                      title={group.name}
                      description={group.default_currency}
                      imageUrl={group.icon_url}
                      onPress={() =>
                        pick({
                          type: "group",
                          id: group.id,
                          name: group.name,
                          currency: group.default_currency,
                          image_url: group.icon_url
                        })
                      }
                    />
                  ))}
                </Section>
                <Section title={t("overview.friends")} emptyText={t("overview.noFriends")} items={filteredFriends}>
                  {filteredFriends.map((friend) => (
                    <ContextRow
                      key={`f-${friend.id}`}
                      title={friend.display_name}
                      description={friend.default_currency}
                      imageUrl={friend.avatar_url}
                      onPress={() =>
                        pick({
                          type: "friendship",
                          id: friend.id,
                          name: friend.display_name,
                          currency: friend.default_currency,
                          image_url: friend.avatar_url
                        })
                      }
                    />
                  ))}
                </Section>
              </>
            )}
          </ScrollView>
        </ContentWidth>
      </Modal>
    </Portal>
  );
}

function filterByQuery<T>(items: T[], query: string, label: (item: T) => string): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => label(item).toLowerCase().includes(normalized));
}

function Section({
  title,
  emptyText,
  items,
  children
}: Readonly<{
  title: string;
  emptyText: string;
  items: unknown[];
  children: React.ReactNode;
}>) {
  return (
    <View style={styles.sectionGap}>
      <Text variant="titleMedium" style={styles.sectionLabel}>
        {title}
      </Text>
      {items.length ? children : <Text variant="bodyMedium">{emptyText}</Text>}
    </View>
  );
}

function ContextRow({
  title,
  description,
  imageUrl,
  imageSource,
  onPress
}: Readonly<{
  title: string;
  description: string;
  imageUrl?: string;
  imageSource?: Parameters<typeof PersonAvatar>[0]["imageSource"];
  onPress: () => void;
}>) {
  return (
    <>
      <List.Item
        style={styles.listItemDense}
        title={title}
        description={description}
        left={() => <PersonAvatar name={title} imageUrl={imageUrl} imageSource={imageSource} />}
        right={(props) => <List.Icon {...props} icon="chevron-right" />}
        onPress={onPress}
      />
      <Divider />
    </>
  );
}

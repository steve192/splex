import { ReactNode, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Checkbox, Divider, List, Modal, Portal, Searchbar, Text, useTheme } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import { useKeyboardHeight } from "../lib/useKeyboardHeight";
import { ContentWidth } from "./ContentWidth";
import { styles } from "./styles";

export type SelectionOption<T extends string | number> = {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
};

type BaseProps<T extends string | number> = {
  visible: boolean;
  title: string;
  options: SelectionOption<T>[];
  searchable?: boolean;
  emptyText?: string;
  footer?: ReactNode;
  onDismiss: () => void;
};

type SingleSelectionProps<T extends string | number> = BaseProps<T> & {
  multiple?: false;
  value: T | null;
  onSelect: (value: T) => void;
};

type MultipleSelectionProps<T extends string | number> = BaseProps<T> & {
  multiple: true;
  value: T[];
  onChange: (value: T[]) => void;
};

export type SelectionSheetProps<T extends string | number> =
  | SingleSelectionProps<T>
  | MultipleSelectionProps<T>;

export function SelectionSheet<T extends string | number>(props: SelectionSheetProps<T>) {
  const { t } = useI18n();
  const theme = useTheme();
  const keyboardHeight = useKeyboardHeight();
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return props.options;
    return props.options.filter((option) => {
      const text = `${option.label} ${option.description ?? ""}`.toLowerCase();
      return text.includes(normalizedQuery);
    });
  }, [props.options, query]);

  function selected(value: T): boolean {
    return props.multiple ? props.value.includes(value) : props.value === value;
  }

  function select(value: T) {
    if (props.multiple) {
      props.onChange(
        props.value.includes(value)
          ? props.value.filter((current) => current !== value)
          : [...props.value, value]
      );
      return;
    }
    props.onSelect(value);
    props.onDismiss();
  }

  return (
    <Portal>
      <Modal
        visible={props.visible}
        onDismiss={props.onDismiss}
        contentContainerStyle={[styles.bottomSheet, { backgroundColor: theme.colors.surface }]}
        style={[styles.bottomSheetWrapper, { marginBottom: keyboardHeight }]}
      >
        <ContentWidth>
          <View style={[styles.bottomSheetHandle, { backgroundColor: theme.colors.outlineVariant }]} />
          <View style={styles.rowBetween}>
            <Text variant="titleLarge">{props.title}</Text>
            <Button onPress={props.onDismiss}>{t("common.done")}</Button>
          </View>
          {props.searchable ? (
            <Searchbar
              value={query}
              onChangeText={setQuery}
              placeholder={t("common.search")}
              style={styles.searchbarInSheet}
            />
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled">
            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <View key={String(option.value)}>
                  <List.Item
                    style={styles.listItemDense}
                    title={option.label}
                    description={option.description}
                    disabled={option.disabled}
                    onPress={() => {
                      if (!option.disabled) select(option.value);
                    }}
                    left={(iconProps) =>
                      props.multiple ? (
                        <Checkbox.Android
                          status={selected(option.value) ? "checked" : "unchecked"}
                          disabled={option.disabled}
                        />
                      ) : (
                        <List.Icon
                          {...iconProps}
                          icon={selected(option.value) ? "radiobox-marked" : "radiobox-blank"}
                        />
                      )
                    }
                  />
                  <Divider />
                </View>
              ))
            ) : (
              <Text variant="bodyMedium">{props.emptyText ?? t("common.noResults")}</Text>
            )}
          </ScrollView>
          {props.footer ? <View style={styles.bottomSheetFooter}>{props.footer}</View> : null}
        </ContentWidth>
      </Modal>
    </Portal>
  );
}

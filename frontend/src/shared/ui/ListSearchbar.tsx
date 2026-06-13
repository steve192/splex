import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { Searchbar } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import { styles } from "./styles";

type ListSearchbarProps = {
  value: string;
  onChangeText: (text: string) => void;
  onClose: () => void;
  /**
   * Applies the compact styling needed to fit inside a navigation header. Omit
   * for an inline searchbar rendered in the screen body.
   */
  compact?: boolean;
};

/** Searchbar used to filter a list, either inline or inside a navigation header. */
export function ListSearchbar({ value, onChangeText, onClose, compact = false }: Readonly<ListSearchbarProps>) {
  const { t } = useI18n();
  return (
    <Searchbar
      autoFocus
      placeholder={t("common.search")}
      value={value}
      onChangeText={onChangeText}
      icon="close"
      onIconPress={onClose}
      style={compact ? styles.searchbarInHeader : undefined}
      inputStyle={compact ? styles.searchbarInHeaderInput : undefined}
    />
  );
}

/**
 * Header options that let an in-header {@link ListSearchbar} span the full
 * available width. `headerTitleContainerStyle`/`headerRightContainerStyle` are
 * honoured by the web/JS header but are absent from native-stack's option
 * types, so they are set through a localized cast here rather than in every
 * screen.
 */
export function headerSearchLayout(active: boolean): Partial<NativeStackNavigationOptions> {
  return {
    headerTitleAlign: active ? "left" : undefined,
    headerTitleContainerStyle: active ? styles.headerSearchContainer : undefined,
    headerRightContainerStyle: active ? styles.headerSearchRightCollapsed : undefined
  } as Partial<NativeStackNavigationOptions>;
}

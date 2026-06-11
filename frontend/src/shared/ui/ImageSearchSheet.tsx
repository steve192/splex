import { useCallback, useEffect, useState } from "react";
import { FlatList, Image, Platform, useWindowDimensions, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  IconButton,
  Modal,
  Portal,
  Searchbar,
  Text,
  TouchableRipple,
  useTheme
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useI18n } from "../i18n/I18nContext";
import { useKeyboardHeight } from "../lib/useKeyboardHeight";
import { styles } from "./styles";

export type OpenverseImage = {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
  creator: string;
  creatorUrl: string;
  license: string;
  licenseVersion: string;
  licenseUrl: string;
  sourceUrl: string;
};

type ImageSearchSheetProps = {
  visible: boolean;
  initialQuery: string;
  onDismiss: () => void;
  onPick: (image: OpenverseImage) => void;
};

const PAGE_SIZE = 20;
const ENDPOINT = "https://api.openverse.org/v1/images/";

/**
 * Searches Openverse for commercially-licensed images and lets the caller pick
 * one. Picked images are returned to the caller via onPick; the actual
 * download + crop + upload is handled by the caller so this component stays
 * decoupled from the upload pipeline.
 */
export function ImageSearchSheet({
  visible,
  initialQuery,
  onDismiss,
  onPick
}: Readonly<ImageSearchSheetProps>) {
  const { t } = useI18n();
  const theme = useTheme();
  const keyboardHeight = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // Fit the sheet between the status bar and the keyboard so the search bar
  // stays on screen: the modal is vertically centred, so lifting it by the
  // keyboard height alone would shove its top under the status bar.
  const sheetHeight = Math.max(
    240,
    Math.min(windowHeight * 0.9, windowHeight - insets.top - keyboardHeight - 24)
  );
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<OpenverseImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
      setResults([]);
      setError("");
    }
  }, [visible, initialQuery]);

  const runSearch = useCallback(async (text: string) => {
    if (!text.trim()) {
      setResults([]);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        q: text.trim(),
        page_size: String(PAGE_SIZE),
        license_type: "commercial"
      });
      const response = await fetch(`${ENDPOINT}?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { results: RawOpenverseImage[] };
      setResults((data.results ?? []).map(normalize));
    } catch {
      setError(t("imageSearch.searchFailed"));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Auto-search when the sheet opens with a prefilled query.
  useEffect(() => {
    if (visible && initialQuery.trim()) {
      runSearch(initialQuery);
    }
  }, [visible, initialQuery, runSearch]);

  let bodyContent: React.ReactNode;
  if (loading) {
    bodyContent = (
      <View style={styles.imageSearchEmpty}>
        <ActivityIndicator />
      </View>
    );
  } else if (error) {
    bodyContent = (
      <View style={styles.imageSearchEmpty}>
        <Text>{error}</Text>
        <Button onPress={() => runSearch(query)}>{t("common.retry") ?? t("expense.retrySync")}</Button>
      </View>
    );
  } else if (results.length === 0) {
    bodyContent = (
      <View style={styles.imageSearchEmpty}>
        <Text variant="bodyMedium">{t("imageSearch.empty")}</Text>
      </View>
    );
  } else {
    bodyContent = (
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        numColumns={3}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.imageSearchGrid}
        columnWrapperStyle={styles.imageSearchRow}
        renderItem={({ item }) => (
          <TouchableRipple
            onPress={() => onPick(item)}
            style={styles.imageSearchCell}
            borderless
          >
            <Image source={{ uri: item.thumbnail }} style={styles.imageSearchThumb} />
          </TouchableRipple>
        )}
      />
    );
  }

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.imageSearchSheet,
          {
            backgroundColor: theme.colors.surface,
            height: sheetHeight,
            marginTop: insets.top,
            marginBottom: keyboardHeight
          }
        ]}
      >
        <View style={styles.rowBetween}>
          <Text variant="titleLarge">{t("imageSearch.title")}</Text>
          <IconButton icon="close" onPress={onDismiss} />
        </View>
        <Searchbar
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => runSearch(query)}
          placeholder={t("imageSearch.placeholder")}
          autoFocus={Platform.OS === "web"}
        />
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {t("imageSearch.poweredBy")}
        </Text>
        {bodyContent}
      </Modal>
    </Portal>
  );
}

type RawOpenverseImage = {
  id: string;
  url: string;
  thumbnail: string;
  title?: string;
  creator?: string;
  creator_url?: string;
  license?: string;
  license_version?: string;
  license_url?: string;
  foreign_landing_url?: string;
};

function normalize(raw: RawOpenverseImage): OpenverseImage {
  return {
    id: raw.id,
    url: raw.url,
    thumbnail: raw.thumbnail,
    title: raw.title ?? "",
    creator: raw.creator ?? "",
    creatorUrl: raw.creator_url ?? "",
    license: raw.license ?? "",
    licenseVersion: raw.license_version ?? "",
    licenseUrl: raw.license_url ?? "",
    sourceUrl: raw.foreign_landing_url ?? raw.url
  };
}

/** Build a human-readable attribution string for storage / display. */
export function buildAttributionText(image: OpenverseImage): string {
  const title = image.title || "Untitled";
  const creator = image.creator ? ` by ${image.creator}` : "";
  const licenseVersionSuffix = image.licenseVersion ? ` ${image.licenseVersion}` : "";
  const license = image.license ? ` - ${image.license.toUpperCase()}${licenseVersionSuffix}` : "";
  const sourceUrl = image.sourceUrl ? ` (${image.sourceUrl})` : "";
  return `"${title}"${creator}${license}${sourceUrl}`.trim();
}

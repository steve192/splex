import { useEffect, useMemo, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { IconButton, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { useAuth } from "../../features/auth/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import {
  buildLocationsMapHtml,
  DEFAULT_TILE_URL,
  type MapPoint,
  type LocationsMapMode
} from "./locationsMapModel";
import { LEAFLET_CSS, LEAFLET_JS } from "./leafletAssets.generated";

export type { MapPoint } from "./locationsMapModel";

export interface LocationsMapProps {
  readonly points: ReadonlyArray<MapPoint>;
  readonly height?: number;
}

function buildNativeHtml(points: ReadonlyArray<MapPoint>, tileUrl: string, mode: LocationsMapMode): string {
  return buildLocationsMapHtml(points, tileUrl, { mode })
    .split("__SPLEX_LEAFLET_CSS__")
    .join(LEAFLET_CSS)
    .split("__SPLEX_LEAFLET_JS__")
    .join(LEAFLET_JS);
}

interface LocationsMapCanvasProps {
  readonly html: string;
  readonly height?: number;
  readonly mode: LocationsMapMode;
}

function LocationsMapCanvas({ html, height, mode }: Readonly<LocationsMapCanvasProps>) {
  const interactive = mode === "interactive";

  return (
    <View style={[componentStyles.mapFrame, height ? { height } : componentStyles.fullscreenMapFrame]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={componentStyles.map}
        pointerEvents={interactive ? "auto" : "none"}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        nestedScrollEnabled={interactive}
        androidLayerType="hardware"
      />
    </View>
  );
}

export function LocationsMap({ points, height = 280 }: Readonly<LocationsMapProps>) {
  const { api } = useAuth();
  const { t } = useI18n();
  const theme = useTheme();
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [tileUrl, setTileUrl] = useState<string>(DEFAULT_TILE_URL);

  useEffect(() => {
    api
      .get<{ map_tile_url?: string }>("/api/auth/providers/")
      .then((data) => {
        if (data.map_tile_url) setTileUrl(data.map_tile_url);
      })
      .catch(() => undefined);
  }, [api]);

  const inlineHtml = useMemo(() => buildNativeHtml(points, tileUrl, "static"), [points, tileUrl]);
  const fullscreenHtml = useMemo(() => buildNativeHtml(points, tileUrl, "interactive"), [points, tileUrl]);

  return (
    <View style={componentStyles.root}>
      <LocationsMapCanvas html={inlineHtml} height={height} mode="static" />
      <IconButton
        icon="fullscreen"
        mode="contained-tonal"
        accessibilityLabel={t("map.fullscreen")}
        containerColor={theme.colors.surface}
        iconColor={theme.colors.onSurface}
        onPress={() => setFullscreenVisible(true)}
        style={[componentStyles.mapActionButton, { borderColor: theme.colors.outlineVariant }]}
      />
      <Modal visible={fullscreenVisible} animationType="fade" onRequestClose={() => setFullscreenVisible(false)}>
        <SafeAreaView style={[componentStyles.fullscreen, { backgroundColor: theme.colors.background }]}>
          <LocationsMapCanvas html={fullscreenHtml} mode="interactive" />
          <IconButton
            icon="close"
            mode="contained-tonal"
            accessibilityLabel={t("map.closeFullscreen")}
            containerColor={theme.colors.surface}
            iconColor={theme.colors.onSurface}
            onPress={() => setFullscreenVisible(false)}
            style={[componentStyles.fullscreenCloseButton, { borderColor: theme.colors.outlineVariant }]}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const componentStyles = StyleSheet.create({
  fullscreen: {
    flex: 1
  },
  fullscreenCloseButton: {
    borderWidth: 1,
    position: "absolute",
    right: 12,
    top: 12,
    zIndex: 1000
  },
  fullscreenMapFrame: {
    flex: 1
  },
  map: {
    backgroundColor: "transparent",
    flex: 1
  },
  mapActionButton: {
    borderWidth: 1,
    position: "absolute",
    right: 8,
    top: 8,
    zIndex: 1000
  },
  mapFrame: {
    borderRadius: 8,
    overflow: "hidden",
    zIndex: 0
  },
  root: {
    position: "relative"
  }
});

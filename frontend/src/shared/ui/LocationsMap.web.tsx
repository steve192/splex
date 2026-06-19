import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Modal, StyleSheet, View } from "react-native";
import { IconButton, useTheme } from "react-native-paper";

import { useI18n } from "../i18n/I18nContext";
import {
  DEFAULT_TILE_URL,
  leafletGestureOptions,
  type LocationsMapMode,
  type MapPoint
} from "./locationsMapModel";

const FULLSCREEN_HISTORY_KEY = "splexLocationsMapFullscreen";

export interface LocationsMapProps {
  readonly points: ReadonlyArray<MapPoint>;
  readonly height?: number;
}

const createMarker = () =>
  L.divIcon({
    html: '<div style="background-color: #3b82f6; width: 18px; height: 24px; border-radius: 9px 9px 0 0; border: 2px solid white;"></div>',
    iconSize: [18, 24],
    iconAnchor: [9, 24],
    className: ""
  });

export function LocationsMap({ points, height = 280 }: Readonly<LocationsMapProps>) {
  const { t } = useI18n();
  const theme = useTheme();
  const fullscreenHistoryPushed = useRef(false);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [tileUrl, setTileUrl] = useState<string>(DEFAULT_TILE_URL);

  const closeFullscreen = useCallback(() => {
    if (fullscreenHistoryPushed.current && window.history.state?.[FULLSCREEN_HISTORY_KEY]) {
      fullscreenHistoryPushed.current = false;
      window.history.back();
      return;
    }
    setFullscreenVisible(false);
  }, []);

  useEffect(() => {
    fetch("/api/auth/providers/")
      .then((res) => res.json())
      .then((data: { map_tile_url?: string }) => {
        if (data.map_tile_url) setTileUrl(data.map_tile_url);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!fullscreenVisible) return;

    window.history.pushState({ [FULLSCREEN_HISTORY_KEY]: true }, "");
    fullscreenHistoryPushed.current = true;

    function handlePopState() {
      fullscreenHistoryPushed.current = false;
      setFullscreenVisible(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeFullscreen();
    }

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [fullscreenVisible, closeFullscreen]);

  return (
    <View style={componentStyles.root}>
      <LocationsMapCanvas points={points} tileUrl={tileUrl} height={height} mode="static" />
      <IconButton
        icon="fullscreen"
        mode="contained-tonal"
        accessibilityLabel={t("map.fullscreen")}
        containerColor={theme.colors.surface}
        iconColor={theme.colors.onSurface}
        onPress={() => setFullscreenVisible(true)}
        style={[componentStyles.mapActionButton, { borderColor: theme.colors.outlineVariant }]}
      />
      <Modal visible={fullscreenVisible} animationType="fade" onRequestClose={closeFullscreen}>
        <View style={[componentStyles.fullscreen, { backgroundColor: theme.colors.background }]}>
          <LocationsMapCanvas points={points} tileUrl={tileUrl} mode="interactive" />
          <IconButton
            icon="close"
            mode="contained-tonal"
            accessibilityLabel={t("map.closeFullscreen")}
            containerColor={theme.colors.surface}
            iconColor={theme.colors.onSurface}
            onPress={closeFullscreen}
            style={[componentStyles.fullscreenCloseButton, { borderColor: theme.colors.outlineVariant }]}
          />
        </View>
      </Modal>
    </View>
  );
}

interface LocationsMapCanvasProps {
  readonly points: ReadonlyArray<MapPoint>;
  readonly tileUrl: string;
  readonly height?: number;
  readonly mode: LocationsMapMode;
}

function LocationsMapCanvas({ points, tileUrl, height, mode }: Readonly<LocationsMapCanvasProps>) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);
  const tileLayer = useRef<L.TileLayer | null>(null);
  const interactive = mode === "interactive";

  useEffect(() => {
    if (!container.current) return;

    if (!map.current) {
      map.current = L.map(container.current, leafletGestureOptions(mode) as L.MapOptions);
      markerLayer.current = L.layerGroup().addTo(map.current);
    }

    return () => {
      map.current?.remove();
      map.current = null;
      markerLayer.current = null;
      tileLayer.current = null;
    };
  }, [mode]);

  useEffect(() => {
    if (!map.current) return;

    tileLayer.current?.remove();
    tileLayer.current = L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map.current);
  }, [tileUrl]);

  useEffect(() => {
    if (!map.current || !markerLayer.current) return;

    markerLayer.current.clearLayers();
    if (points.length === 0) {
      map.current.setView([0, 0], 1);
      return;
    }

    const latLngs: [number, number][] = [];
    points.forEach((p) => {
      const marker = L.marker([p.latitude, p.longitude], { icon: createMarker() }).addTo(markerLayer.current!);
      if (p.label) marker.bindPopup(p.label);
      latLngs.push([p.latitude, p.longitude]);
    });

    if (latLngs.length === 1) {
      map.current.setView(latLngs[0], 13);
    } else {
      map.current.fitBounds(L.latLngBounds(latLngs), { padding: [24, 24] });
    }

    window.requestAnimationFrame(() => map.current?.invalidateSize());
  }, [points]);

  return (
    <View style={[componentStyles.mapFrame, height ? { height } : componentStyles.fullscreenMapFrame]}>
      <div
        ref={container}
        style={{
          height: "100%",
          pointerEvents: interactive ? "auto" : "none",
          width: "100%"
        }}
      />
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

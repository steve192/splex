import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Button, Card, Text } from "react-native-paper";
import { WebView } from "react-native-webview";

import { useAuth } from "../../features/auth/AuthContext";
import { openLocationInMaps } from "../location/mapsIntegration";
import { styles } from "./styles";
import { LEAFLET_CSS, LEAFLET_JS } from "./leafletAssets.generated";

export interface LocationMapProps {
  readonly latitude: number;
  readonly longitude: number;
  readonly height?: number;
}

const DEFAULT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

function buildHtml(latitude: number, longitude: number, tileUrl: string): string {
  // Tile URL contains placeholders like {s}/{z}/{x}/{y} — embed as JSON string for safety.
  const safeTileUrl = JSON.stringify(tileUrl);
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
    <style>${LEAFLET_CSS}</style>
    <style>
      html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: transparent; }
      .splex-marker {
        background-color: #3b82f6;
        width: 24px; height: 32px;
        border-radius: 12px 12px 0 0;
        border: 2px solid white;
        display: flex; align-items: center; justify-content: center;
      }
      .splex-marker > div {
        width: 10px; height: 10px;
        background-color: white;
        border-radius: 50%;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>${LEAFLET_JS}</script>
    <script>
      var map = L.map('map', { zoomControl: false, attributionControl: false })
        .setView([${latitude}, ${longitude}], 14);
      L.tileLayer(${safeTileUrl}, { maxZoom: 19 }).addTo(map);
      var icon = L.divIcon({
        html: '<div class="splex-marker"><div></div></div>',
        iconSize: [24, 32],
        iconAnchor: [12, 32],
        className: ''
      });
      L.marker([${latitude}, ${longitude}], { icon: icon }).addTo(map);
    </script>
  </body>
</html>`;
}

export function LocationMap({ latitude, longitude, height = 250 }: Readonly<LocationMapProps>) {
  const { api } = useAuth();
  const [tileUrl, setTileUrl] = useState<string>(DEFAULT_TILE_URL);

  useEffect(() => {
    api
      .get<{ map_tile_url?: string }>("/api/auth/providers/")
      .then((data) => {
        if (data.map_tile_url) setTileUrl(data.map_tile_url);
      })
      .catch(() => undefined);
  }, [api]);

  const html = useMemo(() => buildHtml(latitude, longitude, tileUrl), [latitude, longitude, tileUrl]);

  return (
    <Card mode="elevated">
      <Card.Content style={styles.gap}>
        <View style={{ height, borderRadius: 4, overflow: "hidden" }}>
          <WebView
            originWhitelist={["*"]}
            source={{ html }}
            style={{ flex: 1, backgroundColor: "transparent" }}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
            androidLayerType="hardware"
          />
        </View>
        <View style={{ alignItems: "center" }}>
          <Text variant="bodySmall">
            {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </Text>
        </View>
        <Button mode="contained" onPress={() => openLocationInMaps(latitude, longitude)}>
          Open in Maps
        </Button>
      </Card.Content>
    </Card>
  );
}

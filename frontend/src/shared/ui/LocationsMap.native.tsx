import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

import { useAuth } from "../../features/auth/AuthContext";
import { LEAFLET_CSS, LEAFLET_JS } from "./leafletAssets.generated";

export interface MapPoint {
  readonly latitude: number;
  readonly longitude: number;
  readonly label?: string;
}

export interface LocationsMapProps {
  readonly points: ReadonlyArray<MapPoint>;
  readonly height?: number;
}

const DEFAULT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

function buildHtml(points: ReadonlyArray<MapPoint>, tileUrl: string): string {
  const safeTileUrl = JSON.stringify(tileUrl);
  const safePoints = JSON.stringify(
    points.map((p) => ({ lat: p.latitude, lng: p.longitude, label: p.label ?? "" }))
  );
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
        width: 18px; height: 24px;
        border-radius: 9px 9px 0 0;
        border: 2px solid white;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>${LEAFLET_JS}</script>
    <script>
      var points = ${safePoints};
      var map = L.map('map', { zoomControl: false, attributionControl: false });
      L.tileLayer(${safeTileUrl}, { maxZoom: 19 }).addTo(map);
      var icon = L.divIcon({
        html: '<div class="splex-marker"></div>',
        iconSize: [18, 24],
        iconAnchor: [9, 24],
        className: ''
      });
      if (points.length === 0) {
        map.setView([0, 0], 1);
      } else {
        var latLngs = points.map(function (p) {
          var marker = L.marker([p.lat, p.lng], { icon: icon }).addTo(map);
          if (p.label) marker.bindPopup(p.label);
          return [p.lat, p.lng];
        });
        if (latLngs.length === 1) {
          map.setView(latLngs[0], 13);
        } else {
          map.fitBounds(L.latLngBounds(latLngs), { padding: [24, 24] });
        }
      }
    </script>
  </body>
</html>`;
}

export function LocationsMap({ points, height = 280 }: Readonly<LocationsMapProps>) {
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

  const html = useMemo(() => buildHtml(points, tileUrl), [points, tileUrl]);

  return (
    <View style={{ height, borderRadius: 8, overflow: "hidden" }}>
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
  );
}

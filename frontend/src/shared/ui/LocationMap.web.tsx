import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button, Card, Text } from "react-native-paper";
import { View } from "react-native";
import { useI18n } from "../i18n/I18nContext";
import { openLocationInMaps } from "../location/mapsIntegration";
import { styles } from "./styles";

// Create custom HTML/CSS marker to avoid image loading issues
const createCustomMarker = () =>
  L.divIcon({
    html: '<div style="background-color: #3b82f6; width: 24px; height: 32px; border-radius: 12px 12px 0 0; border: 2px solid white; display: flex; align-items: center; justify-content: center;"><div style="width: 10px; height: 10px; background-color: white; border-radius: 50%;"></div></div>',
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -32],
    className: "custom-marker"
  });

export interface LocationMapProps {
  readonly latitude: number;
  readonly longitude: number;
  readonly height?: number;
}

export function LocationMap({ latitude, longitude, height = 250 }: Readonly<LocationMapProps>) {
  const { t } = useI18n();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [tileUrl, setTileUrl] = useState<string>("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");

  // Fetch map configuration from backend
  useEffect(() => {
    fetch("/api/auth/providers/")
      .then((res) => res.json())
      .then((data: { map_tile_url?: string }) => {
        if (data.map_tile_url) {
          setTileUrl(data.map_tile_url);
        }
      })
      .catch(() => {
        // Use default if fetch fails
      });
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;

    if (map.current) {
      // Update existing map view if coordinates changed
      map.current.setView([latitude, longitude], 13);
      // Clear old markers and add new one
      map.current.eachLayer((layer: L.Layer) => {
        if (layer instanceof L.Marker) {
          map.current!.removeLayer(layer);
        }
      });
      L.marker([latitude, longitude], { icon: createCustomMarker() }).addTo(map.current);
    } else {
      // Initialize map
      map.current = L.map(mapContainer.current).setView([latitude, longitude], 13);

      // Add tile layer from backend configuration
      L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map.current);

      // Add marker with custom icon
      L.marker([latitude, longitude], { icon: createCustomMarker() }).addTo(map.current);
    }
  }, [latitude, longitude, tileUrl]);

  return (
    <Card mode="elevated">
      <Card.Content style={styles.gap}>
        <div
          ref={mapContainer}
          style={{
            height: `${height}px`,
            width: "100%",
            borderRadius: 4,
            overflow: "hidden"
          }}
        />
        <View style={{ alignItems: "center" }}>
          <Text variant="bodySmall" style={{ marginBottom: 8 }}>
            {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </Text>
        </View>
        <Button mode="contained" onPress={() => openLocationInMaps(latitude, longitude)}>
          {t("map.openInMaps")}
        </Button>
      </Card.Content>
    </Card>
  );
}

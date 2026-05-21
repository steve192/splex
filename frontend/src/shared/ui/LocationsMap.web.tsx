import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { View } from "react-native";

export interface MapPoint {
  readonly latitude: number;
  readonly longitude: number;
  readonly label?: string;
}

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
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [tileUrl, setTileUrl] = useState<string>("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");

  useEffect(() => {
    fetch("/api/auth/providers/")
      .then((res) => res.json())
      .then((data: { map_tile_url?: string }) => {
        if (data.map_tile_url) setTileUrl(data.map_tile_url);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!container.current) return;

    if (!map.current) {
      map.current = L.map(container.current);
      L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map.current);
    }

    // Clear existing markers.
    map.current.eachLayer((layer: L.Layer) => {
      if (layer instanceof L.Marker) map.current!.removeLayer(layer);
    });

    if (points.length === 0) {
      map.current.setView([0, 0], 1);
      return;
    }

    const latLngs: [number, number][] = [];
    points.forEach((p) => {
      const marker = L.marker([p.latitude, p.longitude], { icon: createMarker() }).addTo(map.current!);
      if (p.label) marker.bindPopup(p.label);
      latLngs.push([p.latitude, p.longitude]);
    });

    if (latLngs.length === 1) {
      map.current.setView(latLngs[0], 13);
    } else {
      map.current.fitBounds(L.latLngBounds(latLngs), { padding: [24, 24] });
    }
  }, [points, tileUrl]);

  return (
    <View style={{ height, borderRadius: 8, overflow: "hidden" }}>
      <div ref={container} style={{ height: "100%", width: "100%" }} />
    </View>
  );
}

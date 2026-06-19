export interface MapPoint {
  readonly latitude: number;
  readonly longitude: number;
  readonly label?: string;
}

export type LocationsMapMode = "static" | "interactive";

export interface LocationsMapHtmlOptions {
  readonly mode: LocationsMapMode;
}

export const DEFAULT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export function isLocationsMapInteractive(mode: LocationsMapMode): boolean {
  return mode === "interactive";
}

export function locationMapPoint(latitude: number, longitude: number): MapPoint {
  return { latitude, longitude };
}

export function leafletGestureOptions(mode: LocationsMapMode) {
  const enabled = isLocationsMapInteractive(mode);

  return {
    boxZoom: enabled,
    doubleClickZoom: enabled,
    dragging: enabled,
    keyboard: enabled,
    scrollWheelZoom: enabled,
    touchZoom: enabled,
    zoomControl: enabled
  };
}

export function buildLocationsMapHtml(
  points: ReadonlyArray<MapPoint>,
  tileUrl: string,
  options: LocationsMapHtmlOptions
): string {
  const safeTileUrl = JSON.stringify(tileUrl);
  const safePoints = JSON.stringify(
    points.map((p) => ({ lat: p.latitude, lng: p.longitude, label: p.label ?? "" }))
  );
  const safeMapOptions = JSON.stringify({
    ...leafletGestureOptions(options.mode),
    attributionControl: false
  });

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
    <style>__SPLEX_LEAFLET_CSS__</style>
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
    <script>__SPLEX_LEAFLET_JS__</script>
    <script>
      var points = ${safePoints};
      var map = L.map('map', ${safeMapOptions});
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

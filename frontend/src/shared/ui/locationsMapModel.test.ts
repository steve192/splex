import { describe, expect, it } from "vitest";

import { buildLocationsMapHtml, leafletGestureOptions, locationMapPoint } from "./locationsMapModel";

describe("locationsMapModel", () => {
  it("disables Leaflet gestures for the embedded statistics map", () => {
    const options = leafletGestureOptions("static");

    expect(options).toMatchObject({
      dragging: false,
      scrollWheelZoom: false,
      touchZoom: false,
      zoomControl: false
    });
  });

  it("enables Leaflet gestures for the fullscreen statistics map", () => {
    const options = leafletGestureOptions("interactive");

    expect(options).toMatchObject({
      dragging: true,
      scrollWheelZoom: true,
      touchZoom: true,
      zoomControl: true
    });
  });

  it("writes the gesture mode into the native WebView HTML", () => {
    const html = buildLocationsMapHtml(
      [{ latitude: 52.52, longitude: 13.405, label: "Dinner" }],
      "https://tiles.example/{z}/{x}/{y}.png",
      { mode: "static" }
    );

    expect(html).toContain('"dragging":false');
    expect(html).toContain('"scrollWheelZoom":false');
    expect(html).toContain('"touchZoom":false');
  });

  it("builds a single expense location point for the shared map renderer", () => {
    expect(locationMapPoint(52.52, 13.405)).toEqual({
      latitude: 52.52,
      longitude: 13.405
    });
  });
});

import { describe, expect, it } from "vitest";

import { normalizeLoginConfig, resolveLoginToken, shouldShowDemoMode } from "./loginHelpers";

describe("normalizeLoginConfig", () => {
  it("maps configured providers into screen state", () => {
    expect(
      normalizeLoginConfig({
        google: { client_id: "web-id", android_client_id: "android-id" },
        demo_mode_enabled: true,
      })
    ).toEqual({
      googleClientId: "web-id",
      googleAndroidClientId: "android-id",
      demoModeEnabled: true,
    });
  });

  it("falls back to hidden providers when config is missing", () => {
    expect(normalizeLoginConfig(undefined)).toEqual({
      googleClientId: null,
      googleAndroidClientId: undefined,
      demoModeEnabled: false,
    });
  });
});

describe("resolveLoginToken", () => {
  it("prefers the route token over the URL token", () => {
    expect(resolveLoginToken("native-token", "web-token")).toBe("native-token");
  });

  it("falls back to the URL token when needed", () => {
    expect(resolveLoginToken(undefined, "web-token")).toBe("web-token");
  });
});

describe("shouldShowDemoMode", () => {
  it("requires both provider resolution and demo mode", () => {
    expect(shouldShowDemoMode(true, true)).toBe(true);
    expect(shouldShowDemoMode(true, false)).toBe(false);
    expect(shouldShowDemoMode(false, true)).toBe(false);
  });
});

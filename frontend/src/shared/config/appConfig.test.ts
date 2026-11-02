import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readAppConfig() {
  return JSON.parse(readFileSync(resolve(__dirname, "../../../app.json"), "utf8")) as {
    expo?: {
      android?: {
        permissions?: string[];
      };
      plugins?: (string | [string, unknown])[];
    };
  };
}

function getPluginOptions(pluginName: string): unknown {
  const plugin = readAppConfig().expo?.plugins?.find(
    (entry) => (Array.isArray(entry) ? entry[0] : entry) === pluginName
  );
  return Array.isArray(plugin) ? plugin[1] : undefined;
}

describe("app config", () => {
  it("declares Android vibration permission for calculator key feedback", () => {
    expect(readAppConfig().expo?.android?.permissions).toContain("VIBRATE");
  });

  it("enables R8 minification for Android release builds (Google Play DEX obfuscation requirement)", () => {
    expect(getPluginOptions("expo-build-properties")).toMatchObject({
      android: { enableMinifyInReleaseBuilds: true }
    });
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readAppConfig() {
  return JSON.parse(readFileSync(resolve(__dirname, "../../../app.json"), "utf8")) as {
    expo?: {
      android?: {
        permissions?: string[];
      };
    };
  };
}

describe("app config", () => {
  it("declares Android vibration permission for calculator key feedback", () => {
    expect(readAppConfig().expo?.android?.permissions).toContain("VIBRATE");
  });
});

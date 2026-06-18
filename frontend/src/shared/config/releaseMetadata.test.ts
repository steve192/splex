import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readJson(path: string) {
  return JSON.parse(readFileSync(resolve(__dirname, path), "utf8")) as Record<string, any>;
}

describe("release metadata", () => {
  it("keeps package-lock root versions in sync with package.json", () => {
    const pkg = readJson("../../../package.json");
    const lock = readJson("../../../package-lock.json");

    expect(lock.version).toBe(pkg.version);
    expect(lock.packages?.[""]?.version).toBe(pkg.version);
  });

  it("commits package-lock.json in semantic-release version bumps", () => {
    const releaseConfig = readJson("../../../../.releaserc.json");
    const gitPlugin = releaseConfig.plugins.find((entry: unknown) =>
      Array.isArray(entry) && entry[0] === "@semantic-release/git"
    );

    expect(gitPlugin?.[1]?.assets).toContain("frontend/package-lock.json");
  });
});

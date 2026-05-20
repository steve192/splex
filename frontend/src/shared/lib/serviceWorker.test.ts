import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The service worker (`public/sw.js`) lives outside the TS build and can't be
 * imported normally. We load it as source, splice out the predicate, and
 * evaluate it in isolation. This keeps the predicate single-source while still
 * exercising its actual implementation.
 */
const here = dirname(fileURLToPath(import.meta.url));
const swSource = readFileSync(resolve(here, "../../../public/sw.js"), "utf8");

const predicateMatch = swSource.match(/function isServerRendered\([\s\S]*?\n\}/);
if (!predicateMatch) {
  throw new Error("Could not locate isServerRendered in sw.js");
}
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const isServerRendered = new Function(
  `${predicateMatch[0]}\nreturn isServerRendered;`
)() as (pathname: string) => boolean;

describe("service worker isServerRendered", () => {
  it("excludes /admin/ from SW interception", () => {
    expect(isServerRendered("/admin/")).toBe(true);
    expect(isServerRendered("/admin")).toBe(true);
    expect(isServerRendered("/admin/login/")).toBe(true);
    expect(isServerRendered("/admin/auth/user/")).toBe(true);
  });

  it("excludes /static/ (Django admin CSS via whitenoise)", () => {
    expect(isServerRendered("/static/admin/css/base.css")).toBe(true);
    expect(isServerRendered("/static/")).toBe(true);
  });

  it("does not exclude SPA paths", () => {
    expect(isServerRendered("/")).toBe(false);
    expect(isServerRendered("/groups/42")).toBe(false);
    expect(isServerRendered("/account")).toBe(false);
    expect(isServerRendered("/invite/abc")).toBe(false);
  });

  it("does not exclude paths that merely contain 'admin'", () => {
    expect(isServerRendered("/groups/admin-fixes")).toBe(false);
  });
});

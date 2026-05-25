import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { rewriteViewport, VIEWPORT_TAG } = require("../../../scripts/inject-pwa-meta.js");

const baseHtml = (viewport: string) => `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8" />
  ${viewport}
  <title>Splex</title>
</head><body></body></html>`;

describe("PWA viewport rewriting", () => {
  it("replaces the default expo viewport with a pinch-zoom-disabled one", () => {
    const original = baseHtml('<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />');
    const { html, changed } = rewriteViewport(original);
    expect(changed).toBe(true);
    expect(html).toContain(VIEWPORT_TAG);
    expect(VIEWPORT_TAG).toContain("user-scalable=no");
    expect(VIEWPORT_TAG).toContain("maximum-scale=1");
  });

  it("is idempotent when the viewport tag is already correct", () => {
    const original = baseHtml(VIEWPORT_TAG);
    const { html, changed } = rewriteViewport(original);
    expect(changed).toBe(false);
    expect(html).toBe(original);
  });

  it("leaves HTML without a viewport tag untouched", () => {
    const original = "<html><head><title>x</title></head></html>";
    const { html, changed } = rewriteViewport(original);
    expect(changed).toBe(false);
    expect(html).toBe(original);
  });
});

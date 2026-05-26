const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

// Regenerate leaflet asset bundle on every Metro startup so dependency bumps
// (e.g. Dependabot/Renovate updating `leaflet`) flow through without any
// manual step, even if the developer skipped `npm install` before bundling.
// Idempotent: only writes when content actually changes.
require("./scripts/build-leaflet-assets.js");

// Same pattern for PWA icons - regenerate the 192/512 PNGs from the maskable
// source whenever it changes. Run as a sync child process because jimp is
// async; we need the icons on disk before `expo export` copies public/ to
// dist/. Idempotent (SHA-stamped), so a no-op call is fast.
execFileSync(process.execPath, [path.join(__dirname, "scripts/build-pwa-icons.js")], {
  stdio: "inherit"
});

// Generate the third-party notices inventory from package-lock.json on every
// Metro startup. This mirrors the other generated-asset hooks without adding
// another npm lifecycle step. The output stays in src/ and is served only via
// the backend API, not as a public static file.
execFileSync(process.execPath, [path.join(__dirname, "scripts/generate-open-source-components.js")], {
  stdio: "inherit"
});

// After `expo export` finishes writing dist/index.html, patch it with the PWA
// meta tags (manifest, theme-color, apple-touch-icon). Expo's exporter has no
// pre-write hook for index.html, so we run on process exit - it no-ops when
// dist/ doesn't exist (e.g. during `expo start`).
const { inject: injectPwaMeta } = require("./scripts/inject-pwa-meta.js");
process.on("exit", injectPwaMeta);

const config = getDefaultConfig(__dirname);

module.exports = config;

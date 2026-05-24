const { getDefaultConfig } = require("expo/metro-config");

// Regenerate leaflet asset bundle on every Metro startup so dependency bumps
// (e.g. Dependabot/Renovate updating `leaflet`) flow through without any
// manual step, even if the developer skipped `npm install` before bundling.
// Idempotent: only writes when content actually changes.
require("./scripts/build-leaflet-assets.js");

// After `expo export` finishes writing dist/index.html, patch it with the PWA
// meta tags (manifest, theme-color, apple-touch-icon). Expo's exporter has no
// pre-write hook for index.html, so we run on process exit — it no-ops when
// dist/ doesn't exist (e.g. during `expo start`).
const { inject: injectPwaMeta } = require("./scripts/inject-pwa-meta.js");
process.on("exit", injectPwaMeta);

const config = getDefaultConfig(__dirname);

module.exports = config;

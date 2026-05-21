const { getDefaultConfig } = require("expo/metro-config");

// Regenerate leaflet asset bundle on every Metro startup so dependency bumps
// (e.g. Dependabot/Renovate updating `leaflet`) flow through without any
// manual step, even if the developer skipped `npm install` before bundling.
// Idempotent: only writes when content actually changes.
require("./scripts/build-leaflet-assets.js");

const config = getDefaultConfig(__dirname);

module.exports = config;

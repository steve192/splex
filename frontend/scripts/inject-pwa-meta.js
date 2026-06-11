#!/usr/bin/env node
/* eslint-disable */
/**
 * Patches dist/index.html with the tags needed for the browser to recognize the
 * app as an installable PWA: manifest link, theme-color meta, and an
 * apple-touch-icon for iOS Add-to-Home-Screen. Also rewrites the viewport meta
 * to disable browser-level pinch-to-zoom so the PWA behaves like a native app
 * (in-app pinch gestures for image viewers use react-native-gesture-handler /
 * pointer events with `touch-action: none` and are unaffected).
 *
 * Expo's web export doesn't expose a way to inject these into the generated
 * index.html, so we patch it post-export. Hooked from metro.config.js via
 * `process.on('exit', ...)` so it runs after `expo export` finishes writing
 * files. Idempotent and safe to call when dist/ doesn't exist yet.
 */
const fs = require("fs");
const path = require("path");

// The app is served under this fixed base path (mirrors expo.experiments.baseUrl
// in app.json and BASE_PATH in the app source). public/ assets are copied to
// dist root unprefixed, but Django serves them under the base path, so the
// injected manifest/icon references must carry it.
const BASE_PATH = "/app";

const TAGS = [
  `<link rel="manifest" href="${BASE_PATH}/manifest.webmanifest">`,
  '<meta name="theme-color" content="#006A60">',
  `<link rel="apple-touch-icon" href="${BASE_PATH}/icons/icon-192.png">`,
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="apple-mobile-web-app-title" content="Splex">'
];

const VIEWPORT_TAG =
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no" />';

function rewriteViewport(html) {
  const replaced = html.replace(/<meta\s+name="viewport"[^>]*>/i, VIEWPORT_TAG);
  if (replaced === html) {
    return { html, changed: false };
  }
  return { html: replaced, changed: !html.includes(VIEWPORT_TAG) };
}

function inject() {
  const indexPath = path.join(__dirname, "..", "dist", "index.html");
  if (!fs.existsSync(indexPath)) return;

  const original = fs.readFileSync(indexPath, "utf8");
  const { html: afterViewport, changed: viewportChanged } = rewriteViewport(original);

  const missing = TAGS.filter((tag) => {
    const marker = tag.match(/(href|name)="([^"]+)"/)[0];
    return !afterViewport.includes(marker);
  });

  let updated = afterViewport;
  if (missing.length > 0) {
    updated = afterViewport.replace("</head>", `${missing.join("")}</head>`);
    if (updated === afterViewport) {
      console.error("inject-pwa-meta: failed to find </head> in index.html.");
      return;
    }
  }

  if (updated === original) return;

  fs.writeFileSync(indexPath, updated);
  const parts = [];
  if (missing.length > 0) parts.push(`added ${missing.length} tag(s)`);
  if (viewportChanged) parts.push("rewrote viewport");
  console.log(
    `inject-pwa-meta: ${parts.join(", ")} in ${path.relative(process.cwd(), indexPath)}`
  );
}

module.exports = { inject, rewriteViewport, VIEWPORT_TAG };

if (require.main === module) {
  inject();
}

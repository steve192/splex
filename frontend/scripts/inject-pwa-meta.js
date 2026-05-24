#!/usr/bin/env node
/* eslint-disable */
/**
 * Patches dist/index.html with the tags needed for the browser to recognize the
 * app as an installable PWA: manifest link, theme-color meta, and an
 * apple-touch-icon for iOS Add-to-Home-Screen.
 *
 * Expo's web export doesn't expose a way to inject these into the generated
 * index.html, so we patch it post-export. Hooked from metro.config.js via
 * `process.on('exit', ...)` so it runs after `expo export` finishes writing
 * files. Idempotent and safe to call when dist/ doesn't exist yet.
 */
const fs = require("fs");
const path = require("path");

const TAGS = [
  '<link rel="manifest" href="/manifest.webmanifest">',
  '<meta name="theme-color" content="#006A60">',
  '<link rel="apple-touch-icon" href="/icons/icon-192.png">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="apple-mobile-web-app-title" content="Splex">'
];

function inject() {
  const indexPath = path.join(__dirname, "..", "dist", "index.html");
  if (!fs.existsSync(indexPath)) return;

  const html = fs.readFileSync(indexPath, "utf8");
  const missing = TAGS.filter((tag) => {
    const marker = tag.match(/(href|name)="([^"]+)"/)[0];
    return !html.includes(marker);
  });
  if (missing.length === 0) return;

  const updated = html.replace("</head>", `${missing.join("")}</head>`);
  if (updated === html) {
    console.error("inject-pwa-meta: failed to find </head> in index.html.");
    return;
  }

  fs.writeFileSync(indexPath, updated);
  console.log(
    `inject-pwa-meta: added ${missing.length} tag(s) to ${path.relative(process.cwd(), indexPath)}`
  );
}

module.exports = { inject };

if (require.main === module) {
  inject();
}

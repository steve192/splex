#!/usr/bin/env node
/* eslint-disable */
/**
 * Regenerates the PWA icon set in public/icons/ from the canonical source at
 * assets/images/pwa-maskable-icon.png. The browser needs 192x192 and 512x512
 * entries to mint a WebAPK quickly on Android Chrome install — pointing the
 * manifest at the raw multi-MB source means every install round-trips that
 * whole blob to Google's WebAPK minter before the install completes.
 *
 * The source is non-square (1536x1024) with the rounded icon centered and a
 * transparent border. "cover" fit crops the centered 1024x1024 region, which
 * keeps the icon at full size and within the maskable safe zone (~80% inner).
 *
 * Runs from metro.config.js on every Metro startup (matches the leaflet asset
 * pattern). Idempotent: only writes when the source bytes or target size has
 * actually changed.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SOURCE = path.join(__dirname, "..", "assets", "images", "pwa-maskable-icon.png");
const OUT_DIR = path.join(__dirname, "..", "public", "icons");
const SIZES = [192, 512];
const STAMP_FILE = path.join(OUT_DIR, ".source-sha");

async function generate() {
  if (!fs.existsSync(SOURCE)) return;

  const sourceBuf = fs.readFileSync(SOURCE);
  const sourceSha = crypto.createHash("sha1").update(sourceBuf).digest("hex");

  const allTargetsPresent = SIZES.every((size) =>
    fs.existsSync(path.join(OUT_DIR, `icon-${size}.png`))
  );
  const stampMatches =
    fs.existsSync(STAMP_FILE) && fs.readFileSync(STAMP_FILE, "utf8") === sourceSha;
  if (allTargetsPresent && stampMatches) return;

  // jimp-compact is bundled with @expo/image-utils (transitive via
  // expo-location → @expo/image-utils). No extra dep to manage.
  const { jimpAsync } = require("@expo/image-utils");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const size of SIZES) {
    const buf = await jimpAsync(
      { input: SOURCE, originalInput: path.basename(SOURCE), format: "image/png" },
      [{ operation: "resize", fit: "cover", width: size, height: size }]
    );
    fs.writeFileSync(path.join(OUT_DIR, `icon-${size}.png`), buf);
  }
  fs.writeFileSync(STAMP_FILE, sourceSha);
  console.log(`build-pwa-icons: regenerated ${SIZES.length} icon(s) from ${path.relative(process.cwd(), SOURCE)}`);
}

module.exports = { generate };

if (require.main === module) {
  generate().catch((err) => {
    console.error("build-pwa-icons:", err);
    process.exit(1);
  });
}

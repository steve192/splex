// Copies the marketing screenshots from the repo's docs/screenshots into the
// landing project so Astro's image pipeline can optimize them, plus the wide
// banner for the Open Graph preview image. Run before dev/build.
//
// Screenshots are deliberately not checked into frontend-landing/ — this keeps
// a single source of truth in docs/screenshots/ and avoids duplicating binaries
// in the repo. In Docker, the build stage copies docs/ alongside this project.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");
const repoRoot = join(projectRoot, "..");
const screenshotsSrc = join(repoRoot, "docs", "screenshots");

if (!existsSync(screenshotsSrc)) {
  console.warn(`sync-assets: ${screenshotsSrc} not found; skipping (using whatever is present).`);
  process.exit(0);
}

const assetsDest = join(projectRoot, "src", "assets", "screenshots");
mkdirSync(assetsDest, { recursive: true });

let copied = 0;
for (const file of readdirSync(screenshotsSrc)) {
  if (!/\.(png|jpe?g|webp)$/i.test(file)) continue;
  cpSync(join(screenshotsSrc, file), join(assetsDest, file));
  copied += 1;
}

const publicDir = join(projectRoot, "public");
mkdirSync(publicDir, { recursive: true });

// The wide banner doubles as the Open Graph / Twitter card image; it must live
// in public/ so it is served at a stable absolute URL.
const banner = join(screenshotsSrc, "banner.png");
if (existsSync(banner)) {
  cpSync(banner, join(publicDir, "og-banner.png"));
}

// The app's maskable icon is the favicon shown in the browser tab / title bar.
const appIcon = join(repoRoot, "frontend", "assets", "images", "pwa-maskable-icon.png");
if (existsSync(appIcon)) {
  cpSync(appIcon, join(publicDir, "favicon.png"));
}

console.log(`sync-assets: copied ${copied} screenshot(s) into src/assets/screenshots.`);

import type { ImageMetadata } from "astro";

// Eagerly import every screenshot synced from docs/screenshots so we can look
// them up by base filename (e.g. "overview", "add-expense", "banner").
const files = import.meta.glob<{ default: ImageMetadata }>(
  "./assets/screenshots/*.{png,jpg,jpeg,webp}",
  { eager: true }
);

const byName: Record<string, ImageMetadata> = {};
for (const [path, mod] of Object.entries(files)) {
  const name = path.split("/").pop()!.replace(/\.\w+$/, "");
  byName[name] = mod.default;
}

export function shot(name: string): ImageMetadata {
  const image = byName[name];
  if (!image) {
    throw new Error(
      `Missing screenshot "${name}". Run "npm run sync-assets" (copies from docs/screenshots).`
    );
  }
  return image;
}

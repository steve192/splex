// Not @ts-check'd: @tailwindcss/vite and Astro bundle slightly different Vite
// type versions, which trips a spurious PluginOption mismatch under astro check.
// The build itself is unaffected.
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// The public site URL is configurable at build time so canonical / Open Graph /
// sitemap URLs are correct for whatever domain the operator deploys under.
// Defaults to the reference instance.
const site = process.env.LANDING_SITE_URL ?? "https://splex.sterul.com";

export default defineConfig({
  site,
  // Static output: the build is a folder of HTML/CSS/JS served by Django at "/".
  output: "static",
  // English at the root ("/"), German under "/de/". The browser's preferred
  // language is detected client-side (see Layout.astro) and search engines get
  // per-locale URLs with hreflang alternates for SEO.
  i18n: {
    defaultLocale: "en",
    locales: ["en", "de"],
    routing: { prefixDefaultLocale: false }
  },
  integrations: [
    // Emits per-locale sitemap entries with hreflang alternates. The app (and
    // its legal pages) live under /app and are kept out of the sitemap.
    sitemap({
      i18n: { defaultLocale: "en", locales: { en: "en", de: "de" } }
    })
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});

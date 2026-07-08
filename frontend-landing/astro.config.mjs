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
const localizedPagePairs = [
  ["/splitwise-alternative/", "/de/splitwise-alternative/"],
  ["/self-hosting/", "/de/selbst-hosten/"],
  ["/use-cases/travel-expenses/", "/de/anwendungsfaelle/reiseausgaben/"],
  ["/use-cases/shared-household-expenses/", "/de/anwendungsfaelle/haushaltsausgaben/"],
  ["/docs/friends-and-groups/", "/de/dokumentation/freunde-und-gruppen/"],
  ["/docs/currency-calculator/", "/de/dokumentation/waehrungsrechner/"],
  ["/docs/balances-and-settlements/", "/de/dokumentation/offene-betraege-und-ausgleich/"],
  ["/docs/adding-expenses/", "/de/dokumentation/ausgaben-erfassen/"],
  ["/glossary/", "/de/glossar/"],
];
const alternateByUrl = new Map(
  localizedPagePairs.flatMap(([enPath, dePath]) => {
    const enUrl = new URL(enPath, site).toString();
    const deUrl = new URL(dePath, site).toString();
    const links = [
      { lang: "en", url: enUrl },
      { lang: "de", url: deUrl },
      { lang: "x-default", url: enUrl },
    ];
    return [
      [enUrl, links],
      [deUrl, links],
    ];
  })
);

export default defineConfig({
  site,
  // Static output: the build is a folder of HTML/CSS/JS served by Django at "/".
  output: "static",
  redirects: {
    "/de/dokumentation/salden-und-ausgleich/": "/de/dokumentation/offene-betraege-und-ausgleich/"
  },
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
      i18n: { defaultLocale: "en", locales: { en: "en", de: "de" } },
      serialize(item) {
        return {
          ...item,
          links: alternateByUrl.get(item.url) ?? item.links,
        };
      },
    })
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});

// Single place for the app paths and external links used across the landing.
// The app (and its legal pages) live under /app; the landing never duplicates
// legal content - it links to the same routes the app serves.
export const APP_BASE_PATH = "/app";

export const links = {
  app: `${APP_BASE_PATH}/`,
  login: `${APP_BASE_PATH}/login`,
  tos: `${APP_BASE_PATH}/tos`,
  privacy: `${APP_BASE_PATH}/privacy`,
  imprint: `${APP_BASE_PATH}/imprint`,
  github: "https://github.com/steve192/splex",
  playStore: "https://play.google.com/store/apps/details?id=com.sterul.splex"
} as const;

// Locale-independent site metadata. Translatable copy lives in content.ts.
export const site = {
  name: "Splex",
  ogImage: "/og-banner.png"
} as const;

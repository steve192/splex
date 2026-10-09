import { defineConfig, devices } from "@playwright/test";

// Browser smoke tests against the exported web build (run `npm run build:web`
// first). They catch bundle-level breakage - e.g. a dependency that crashes on
// react-native-web at import time - that unit tests in Node cannot see.
const port = 4173;

export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results/playwright",
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    ...devices["Desktop Chrome"]
  },
  webServer: {
    command: `node scripts/serve-web-dist.js --port ${port}`,
    url: `http://localhost:${port}/app/`,
    reuseExistingServer: !process.env.CI
  }
});

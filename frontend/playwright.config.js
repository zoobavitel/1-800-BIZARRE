const { defineConfig } = require("@playwright/test");

/** Matches CRA `homepage` / GitHub Pages path (see frontend/package.json). */
const APP_BASE_PATH = "/1-800-BIZARRE";
const DEFAULT_ORIGIN = "http://127.0.0.1:3000";
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || `${DEFAULT_ORIGIN}${APP_BASE_PATH}`;

const webServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER
  ? undefined
  : {
      command: "npm start",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        BROWSER: "none",
        CI: "true",
      },
    };

module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer,
});

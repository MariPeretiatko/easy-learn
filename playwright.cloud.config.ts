import { defineConfig } from "@playwright/test";
export default defineConfig({
  outputDir: "test-results-cloud",
  testDir: "./tests",
  testMatch: "cloud.spec.ts",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 12000 },
  use: {
    baseURL: "http://127.0.0.1:4175",
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4175 --strictPort --outDir dist-cloud",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
  },
});

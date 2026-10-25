import { defineConfig } from "@playwright/test";
const production = process.env.E2E_PRODUCTION === "1";
const localURL = `http://127.0.0.1:${production ? 4173 : 5173}`;
const baseURL = process.env.E2E_BASE_URL ?? localURL;
export default defineConfig({
  testDir: "./tests",
  testIgnore: "auth-entry.spec.ts",
  timeout: 45000,
  expect: { timeout: 7000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    channel: "chrome",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [
            { name: "easy-learn-import-deutsch-a1-a2-b1-ru-v1", value: "done" },
            { name: "easy-learn-import-deutsch-a1-a2-b1-ru-v2", value: "done" },
          ],
        },
      ],
    },
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: production
          ? `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort${process.env.E2E_LOCAL_BUILD ? " --outDir dist-e2e" : ""}`
          : "VITE_ENABLE_LOCAL_WORKSPACE=true VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort",
        url: localURL,
        reuseExistingServer: !process.env.CI,
      },
});

import { execFileSync, spawn } from "node:child_process";
const config = JSON.parse(
  execFileSync("node_modules/.bin/supabase", ["status", "--output", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
const env = {
  ...process.env,
  E2E_CLOUD: "1",
  E2E_LOCAL_SUPABASE_URL: config.API_URL,
  E2E_LOCAL_SERVICE_KEY: config.SERVICE_ROLE_KEY,
  E2E_LOCAL_ANON_KEY: config.ANON_KEY,
  VITE_SUPABASE_URL: config.API_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: config.ANON_KEY,
};
execFileSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build", "--outDir", "dist-cloud"],
  { env, stdio: "inherit" },
);
const child = spawn(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "--config",
    "playwright.cloud.config.ts",
    ...process.argv.slice(2),
  ],
  { env, stdio: "inherit" },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});

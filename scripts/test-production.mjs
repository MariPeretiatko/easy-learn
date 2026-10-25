import { spawn, execFileSync } from "node:child_process";
// The public bundle always requires login. Local workflows use a separate explicit build.
const env = {
  ...process.env,
  VITE_ENABLE_LOCAL_WORKSPACE: "true",
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_PUBLISHABLE_KEY: "",
  E2E_PRODUCTION: "1",
  E2E_LOCAL_BUILD: "1",
};
execFileSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build", "--outDir", "dist-e2e"],
  { env, stdio: "inherit" },
);
const child = spawn(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
  { stdio: "inherit", env },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});

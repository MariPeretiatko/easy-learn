import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const options = {
  cwd: root,
  env: { ...process.env, EASY_LEARN_REQUIRE_CLOUD: "1" },
  stdio: "inherit",
};
for (const args of [
  ["node_modules/typescript/bin/tsc", "-b"],
  ["node_modules/vite/bin/vite.js", "build"],
]) {
  try {
    execFileSync(process.execPath, args, options);
  } catch (error) {
    process.exit(error.status ?? 1);
  }
}

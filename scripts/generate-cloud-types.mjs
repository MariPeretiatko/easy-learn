import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const output = execFileSync(
  "node_modules/.bin/supabase",
  ["gen", "types", "typescript", "--local"],
  { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
);
const schema = output.split("type DatabaseWithoutInternals")[0];
if (!schema.includes("export type Database"))
  throw new Error("Unexpected generated type format");
writeFileSync(
  "src/cloud/database.types.ts",
  "// Generated from the local Supabase schema. Regenerate after SQL changes.\n" +
    schema,
);
execFileSync(
  "node_modules/.bin/prettier",
  ["--write", "src/cloud/database.types.ts"],
  { stdio: "inherit" },
);

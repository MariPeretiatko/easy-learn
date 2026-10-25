import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
const dir = process.argv[2] ?? "dist";
const manifest = JSON.parse(
  readFileSync(join(dir, ".vite/manifest.json"), "utf8"),
);
const seen = new Set();
function visit(key) {
  if (seen.has(key)) return;
  seen.add(key);
  for (const dependency of manifest[key].imports ?? []) visit(dependency);
}
for (const [key, chunk] of Object.entries(manifest))
  if (chunk.isEntry) visit(key);
let bytes = 0,
  gzip = 0;
for (const key of seen) {
  const chunk = manifest[key];
  if (!chunk.file.endsWith(".js")) continue;
  const content = readFileSync(join(dir, chunk.file));
  bytes += content.length;
  gzip += gzipSync(content).length;
}
console.log(
  `Initial JavaScript: ${(bytes / 1024).toFixed(1)} KiB, ${(gzip / 1024).toFixed(1)} KiB gzip (budget 160 KiB gzip).`,
);
if (gzip > 160 * 1024) process.exitCode = 1;

import { afterEach, expect, it, vi } from "vitest";
import { build } from "vite";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cloudBuildPlugin } from "./cloudBuild";
const roots: string[] = [];
afterEach(() => {
  roots.forEach((root) => rmSync(root, { recursive: true, force: true }));
  roots.length = 0;
  vi.restoreAllMocks();
});
function fixture(
  env: Record<string, string>,
  processEnv: Record<string, string>,
  useValues = true,
) {
  const root = mkdtempSync(join(tmpdir(), "easy-learn-build-test-"));
  roots.push(root);
  writeFileSync(
    join(root, "index.html"),
    '<script type="module" src="/main.js"></script>',
  );
  writeFileSync(
    join(root, "main.js"),
    useValues
      ? "console.log(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)"
      : 'console.log("unconfigured client")',
  );
  return {
    root,
    run: () =>
      build({
        configFile: false,
        root,
        envFile: false,
        logLevel: "silent",
        plugins: [cloudBuildPlugin(env, processEnv, "production")],
        define: Object.fromEntries(
          Object.entries(env).map(([name, value]) => [
            `import.meta.env.${name}`,
            JSON.stringify(value),
          ]),
        ),
      }),
  };
}
const valid = {
  VITE_SUPABASE_URL: "https://build-test.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_value",
};
it("embeds build values and emits commit diagnostics without exposing the key", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  const { root, run } = fixture(valid, {
    ...valid,
    CF_PAGES: "1",
    CF_PAGES_COMMIT_SHA: "commit-under-test",
  });
  await run();
  const info = JSON.parse(
    readFileSync(join(root, "dist/build-info.json"), "utf8"),
  );
  expect(info).toMatchObject({
    commit: "commit-under-test",
    supabaseConfigured: true,
    supabaseEmbedded: true,
  });
  expect(JSON.stringify(info)).not.toContain(
    valid.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
  expect(JSON.stringify(log.mock.calls)).not.toContain(
    valid.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
  expect(JSON.stringify(log.mock.calls)).toContain(
    '\\"source\\":\\"process\\"',
  );
});
it.each([
  [{}, { CF_PAGES: "1" }],
  [{ VITE_SUPABASE_URL: valid.VITE_SUPABASE_URL }, { CF_PAGES: "1" }],
  [
    { ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_never_publish" },
    { EASY_LEARN_REQUIRE_CLOUD: "1" },
  ],
  [{ ...valid, VITE_ENABLE_LOCAL_WORKSPACE: "true" }, { CF_PAGES: "1" }],
])(
  "stops an invalid cloud build before publishing output (%j)",
  async (env, processEnv) => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { root, run } = fixture(env, processEnv);
    await expect(run()).rejects.toThrow("[easy-learn:build]");
    expect(existsSync(join(root, "dist/index.html"))).toBe(false);
  },
);
it("rejects a bundle that discarded valid inputs instead of emitting a configured client", async () => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  const { run } = fixture(valid, { CF_PAGES: "1" }, false);
  await expect(run()).rejects.toThrow("absent from the generated JavaScript");
});
it("keeps explicit local and unconfigured CI fixtures available", async () => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  const { root, run } = fixture({}, {});
  await run();
  expect(
    JSON.parse(readFileSync(join(root, "dist/build-info.json"), "utf8")),
  ).toMatchObject({ supabaseConfigured: false, supabaseEmbedded: false });
});

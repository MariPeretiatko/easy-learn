import type { Plugin } from "vite";
import { cloudConfigurationMessage } from "../src/cloud/configuration";
interface Environment {
  [key: string]: string | undefined;
}
export function cloudBuildPlugin(
  env: Environment,
  processEnv: Environment,
  mode: string,
): Plugin {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const error = cloudConfigurationMessage(url, key);
  const required =
    processEnv.CF_PAGES === "1" || processEnv.EASY_LEARN_REQUIRE_CLOUD === "1";
  const field = (name: string) => ({
    present: !!env[name]?.trim(),
    source:
      processEnv[name] !== undefined
        ? "process"
        : env[name] !== undefined
          ? "env-file"
          : "missing",
  });
  return {
    name: "easy-learn-cloud-build",
    apply: "build",
    configResolved(config) {
      console.log(
        "[easy-learn:build] " +
          JSON.stringify({
            root: config.root,
            envDir: config.envDir,
            outDir: config.build.outDir,
            mode,
            command: config.command,
            cloudRequired: required,
            commit:
              processEnv.CF_PAGES_COMMIT_SHA ?? processEnv.GITHUB_SHA ?? null,
            branch: processEnv.CF_PAGES_BRANCH ?? null,
            VITE_SUPABASE_URL: field("VITE_SUPABASE_URL"),
            VITE_SUPABASE_PUBLISHABLE_KEY: field(
              "VITE_SUPABASE_PUBLISHABLE_KEY",
            ),
            supabaseConfigured: !error,
          }),
      );
      if (required && error)
        throw new Error(
          "[easy-learn:build] Cloudflare build stopped: " +
            error +
            " The Vite build process must receive valid public Supabase configuration. See the presence/source diagnostics above. No keys are logged.",
        );
      if (required && env.VITE_ENABLE_LOCAL_WORKSPACE === "true")
        throw new Error(
          "[easy-learn:build] Standalone workspace must not be enabled in a Cloudflare deployment.",
        );
    },
    generateBundle(_, bundle) {
      const chunks = Object.values(bundle).filter(
        (item) => item.type === "chunk",
      );
      const embedded =
        !error &&
        chunks.some((chunk) => chunk.code.includes(url!)) &&
        chunks.some((chunk) => chunk.code.includes(key!));
      if (!error && !embedded)
        this.error(
          "[easy-learn:build] Supabase values were available, but are absent from the generated JavaScript. Refusing to publish a disconnected client.",
        );
      const info = {
        schemaVersion: 1,
        builtAt: new Date().toISOString(),
        commit: processEnv.CF_PAGES_COMMIT_SHA ?? processEnv.GITHUB_SHA ?? null,
        mode,
        supabaseConfigured: !error,
        supabaseEmbedded: embedded,
      };
      this.emitFile({
        type: "asset",
        fileName: "build-info.json",
        source: JSON.stringify(info, null, 2) + "\n",
      });
      console.log("[easy-learn:bundle] " + JSON.stringify(info));
    },
  };
}

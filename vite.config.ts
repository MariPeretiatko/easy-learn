import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import { cloudBuildPlugin } from "./build/cloudBuild";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
const projectRoot = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "VITE_");
  return {
    root: projectRoot,
    envDir: projectRoot,
    build: {
      manifest: true,
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("/node_modules/") && id.includes("@supabase/"))
              return "cloud-sdk";
          },
        },
      },
    },
    plugins: [
      cloudBuildPlugin(env, process.env, mode),
      react(),
      VitePWA({
        registerType: "prompt",
        includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png"],
        manifest: {
          name: "Easy Learn — ваше языковое пространство",
          short_name: "Easy Learn",
          description: "Слова, тексты, видео и практика в одном месте.",
          lang: "ru",
          theme_color: "#4255ff",
          background_color: "#f6f7fb",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            {
              src: "/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,json,ico,png,webp,svg,woff2}"],
          globIgnores: ["**/build-info.json"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api\//, /^\/build-info\.json$/],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          cleanupOutdatedCaches: true,
        },
      }),
    ],
  };
});

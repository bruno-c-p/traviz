import node from "@astrojs/node";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import type { Plugin } from "vite";

const SERVER_ONLY_ID = "\0traviz-server-only";

function serverOnlyGuard(): Plugin {
  return {
    name: "traviz-server-only",
    enforce: "pre",
    resolveId(source, importer, options) {
      if (source !== "server-only") return null;

      if (options.ssr !== true) {
        this.error(`${importer ?? "A client module"} imports a server-only module.`);
      }

      return SERVER_ONLY_ID;
    },
    load(id) {
      return id === SERVER_ONLY_ID ? "export {};" : null;
    },
  };
}

const usesNode = process.env.TRAVIZ_ADAPTER === "node";

export default defineConfig({
  srcDir: "./src",
  output: "server",
  adapter: usesNode ? node({ mode: "standalone" }) : vercel(),
  devToolbar: { enabled: false },
  compressHTML: true,
  prefetch: false,
  security: { checkOrigin: false },
  build: { inlineStylesheets: "always" },
  vite: {
    plugins: [tailwindcss(), serverOnlyGuard()],
    define: { "import.meta.env.TRAVIZ_NODE_SERVER": JSON.stringify(usesNode) },
    build: {
      assetsInlineLimit: (filePath) => /\.m?js$/.test(filePath),
    },
  },
});

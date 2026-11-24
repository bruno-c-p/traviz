import node from "@astrojs/node";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import type { Plugin } from "vite";

const SERVER_ONLY_ID = "\0traviz-server-only";
const APP_SCRIPT_ID = "virtual:traviz-app-script";
const RESOLVED_APP_SCRIPT_ID = `\0${APP_SCRIPT_ID}`;
const APP_ENTRY = fileURLToPath(new URL("./src/features/app-shell/app-entry.ts", import.meta.url));

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

async function bundleAppScript(): Promise<string> {
  const output = await build({
    configFile: false,
    root: fileURLToPath(new URL(".", import.meta.url)),
    logLevel: "warn",
    envPrefix: "PUBLIC_",
    resolve: { tsconfigPaths: true },
    plugins: [serverOnlyGuard()],
    build: {
      write: false,
      minify: true,
      modulePreload: false,
      rolldownOptions: { input: APP_ENTRY, output: { format: "es" } },
    },
  });

  const chunks = [output].flat().flatMap((result) => ("output" in result ? result.output : []));
  const [entry] = chunks;

  if (entry?.type !== "chunk" || chunks.length !== 1 || entry.dynamicImports.length > 0) {
    throw new Error(
      "The app script must build to one chunk with no import(), because it is inlined into the HTML.",
    );
  }

  return entry.code.replaceAll("</script", "<\\/script");
}

function inlineAppScript(): Plugin {
  return {
    name: "traviz-inline-app-script",
    resolveId(source) {
      return source === APP_SCRIPT_ID ? RESOLVED_APP_SCRIPT_ID : null;
    },
    async load(id) {
      if (id !== RESOLVED_APP_SCRIPT_ID) return null;

      return `export default ${JSON.stringify(await bundleAppScript())};`;
    },
    hotUpdate() {
      const appScript = this.environment.moduleGraph.getModuleById(RESOLVED_APP_SCRIPT_ID);

      if (appScript !== undefined) this.environment.moduleGraph.invalidateModule(appScript);
    },
  };
}

const usesNode = process.env.TRAVIZ_ADAPTER === "node";

export default defineConfig({
  srcDir: "./src",
  output: "server",
  adapter: usesNode ? node({ mode: "standalone" }) : vercel(),
  devToolbar: { enabled: false },
  prefetch: false,
  security: { checkOrigin: false },
  build: { inlineStylesheets: "always" },
  vite: {
    plugins: [tailwindcss(), serverOnlyGuard(), inlineAppScript()],
    define: { "import.meta.env.TRAVIZ_NODE_SERVER": JSON.stringify(usesNode) },
    build: {
      assetsInlineLimit: (filePath) => /\.(?:m?js|svg)$/.test(filePath),
    },
  },
});

import node from "@astrojs/node";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import type { Plugin } from "vite";

const legacyPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!process.env.PUBLIC_CLERK_PUBLISHABLE_KEY && legacyPublishableKey) {
  process.env.PUBLIC_CLERK_PUBLISHABLE_KEY = legacyPublishableKey;
}

const SERVER_ONLY_ID = "\0traviz-server-only";
const INLINE_SCRIPT_PREFIX = "virtual:traviz-inline-script/";
const RESOLVED_INLINE_SCRIPT_PREFIX = `\0${INLINE_SCRIPT_PREFIX}`;

const INLINE_SCRIPT_ENTRIES = new Map([
  ["app", "./src/features/app-shell/app-entry.ts"],
  ["sign-in", "./src/features/auth/sign-in-entry.ts"],
  ["verify", "./src/features/auth/verify-entry.ts"],
  ["account-menu", "./src/features/auth/account-menu-entry.ts"],
]);

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

async function bundleInlineScript(entryPath: string): Promise<string> {
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
      rolldownOptions: {
        input: fileURLToPath(new URL(entryPath, import.meta.url)),
        output: { format: "es" },
      },
    },
  });

  const chunks = [output].flat().flatMap((result) => ("output" in result ? result.output : []));
  const [entry] = chunks;

  if (entry?.type !== "chunk" || chunks.length !== 1 || entry.dynamicImports.length > 0) {
    throw new Error(
      `${entryPath} must build to one chunk with no import(), because it is inlined into the HTML.`,
    );
  }

  return entry.code.replaceAll("</script", "<\\/script");
}

function inlineScripts(): Plugin {
  return {
    name: "traviz-inline-scripts",
    resolveId(source) {
      return source.startsWith(INLINE_SCRIPT_PREFIX) ? `\0${source}` : null;
    },
    async load(id) {
      if (!id.startsWith(RESOLVED_INLINE_SCRIPT_PREFIX)) return null;

      const name = id.slice(RESOLVED_INLINE_SCRIPT_PREFIX.length);
      const entryPath = INLINE_SCRIPT_ENTRIES.get(name);

      if (entryPath === undefined) this.error(`No inline script is named ${name}.`);

      return `export default ${JSON.stringify(await bundleInlineScript(entryPath))};`;
    },
    hotUpdate() {
      for (const name of INLINE_SCRIPT_ENTRIES.keys()) {
        const inlineScript = this.environment.moduleGraph.getModuleById(
          `${RESOLVED_INLINE_SCRIPT_PREFIX}${name}`,
        );

        if (inlineScript !== undefined) this.environment.moduleGraph.invalidateModule(inlineScript);
      }
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
    plugins: [tailwindcss(), serverOnlyGuard(), inlineScripts()],
    define: { "import.meta.env.TRAVIZ_NODE_SERVER": JSON.stringify(usesNode) },
    ssr: { noExternal: ["server-only"] },
    build: {
      assetsInlineLimit: (filePath) => /\.(?:m?js|svg)$/.test(filePath),
    },
  },
});

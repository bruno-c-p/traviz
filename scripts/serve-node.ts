import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { z } from "zod";

type Listener = (request: IncomingMessage, response: ServerResponse) => void;

type StaticFile = { readonly body: Buffer; readonly contentType: string };

const CONTENT_TYPES = new Map([
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".json", "application/json"],
  [".webmanifest", "application/manifest+json"],
]);

const HASHED_ASSETS_PREFIX = "/_astro/";
const INDEX_FILE = "/index.html";

const buildRoot = process.cwd();
const clientRoot = join(buildRoot, "dist", "client");
const entryPath = join(buildRoot, "dist", "server", "entry.mjs");

if (!existsSync(entryPath)) {
  console.error(`${entryPath} not found. Run bun run build:node first.`);
  process.exit(1);
}

process.env.ASTRO_NODE_AUTOSTART = "disabled";

const { handler } = z
  .object({ handler: z.custom<Listener>((value) => value instanceof Function) })
  .parse(await import(pathToFileURL(entryPath).href));

const staticFiles = new Map<string, StaticFile>();

for (const file of readdirSync(clientRoot, { recursive: true, encoding: "utf8" })) {
  const contentType = CONTENT_TYPES.get(extname(file));

  if (contentType === undefined) continue;

  const urlPath = `/${file.split(sep).join("/")}`;

  const staticFile = {
    body: gzipSync(readFileSync(join(clientRoot, file)), { level: 9 }),
    contentType,
  };

  staticFiles.set(urlPath, staticFile);

  if (urlPath.endsWith(INDEX_FILE)) {
    const pagePath = urlPath.slice(0, -INDEX_FILE.length);

    staticFiles.set(pagePath === "" ? "/" : pagePath, staticFile);
  }
}

function gzippedFileFor(request: IncomingMessage): StaticFile | undefined {
  const isRead = request.method === "GET" || request.method === "HEAD";
  const acceptsGzip = /\bgzip\b/.test(String(request.headers["accept-encoding"] ?? ""));
  const [urlPath = "/"] = (request.url ?? "/").split(/[?#]/);

  return isRead && acceptsGzip ? staticFiles.get(urlPath) : undefined;
}

const server = createServer((request, response) => {
  const staticFile = gzippedFileFor(request);

  if (staticFile === undefined) {
    handler(request, response);

    return;
  }

  response.writeHead(200, {
    "content-type": staticFile.contentType,
    "content-encoding": "gzip",
    "content-length": staticFile.body.length,
    vary: "accept-encoding",
    "cache-control": request.url?.startsWith(HASHED_ASSETS_PREFIX)
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  });
  response.end(request.method === "HEAD" ? undefined : staticFile.body);
});

const port = Number(process.env.PORT ?? 4321);
const host = process.env.HOST ?? "localhost";

server.listen(port, host, () => {
  console.log(`traviz listening on http://${host}:${port}`);
});

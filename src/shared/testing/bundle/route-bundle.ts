import { posix } from "node:path";
import { gzipSync } from "node:zlib";
import { PAGE_ORIGIN, readPageScripts } from "@/shared/testing/bundle/page-scripts";

export type ChunkReader = (chunkPath: string) => string | null;

export type SizedChunk = { readonly chunkPath: string; readonly gzipBytes: number };

export type RouteBundle = {
  readonly firstLoadGzipBytes: number;
  readonly lazyGzipBytes: number;
  readonly htmlGzipBytes: number;
  readonly lazyChunks: readonly SizedChunk[];
  readonly hasModuleScript: boolean;
  readonly problems: readonly string[];
};

const INLINE_SCRIPT_PATH = "_astro/inline.js";

function gzipBytesOf(content: string): number {
  return gzipSync(content, { level: 9 }).length;
}

function chunkPathOf(url: URL): string | null {
  return url.origin === PAGE_ORIGIN ? url.pathname.slice(1) : null;
}

function resolveFrom(importerPath: string, specifier: string): string {
  return specifier.startsWith("/")
    ? specifier.slice(1)
    : posix.join(posix.dirname(importerPath), specifier);
}

function staticImportPaths(importerPath: string, source: string): string[] {
  return [...source.matchAll(/(?:from|import)\s*["'`]((?:\.{0,2}\/)+[\w./-]+\.m?js)["'`]/g)].map(
    ([, specifier = ""]) => resolveFrom(importerPath, specifier),
  );
}

function mentionedPaths(importerPath: string, source: string): string[] {
  const fileNames = new Set([...source.matchAll(/[\w.-]+\.m?js/g)].map(([fileName]) => fileName));

  return [...fileNames].map((fileName) => resolveFrom(importerPath, fileName));
}

function reachedFrom(
  startPaths: readonly string[],
  stepsFrom: (chunkPath: string) => readonly string[],
): string[] {
  const reached = new Set(startPaths);
  const pending = [...startPaths];

  for (let chunkPath = pending.pop(); chunkPath !== undefined; chunkPath = pending.pop()) {
    for (const next of stepsFrom(chunkPath)) {
      if (reached.has(next)) continue;

      reached.add(next);
      pending.push(next);
    }
  }

  return [...reached];
}

export function measureRoute(html: string, readChunk: ChunkReader): RouteBundle {
  const scripts = readPageScripts(html);
  const inlineSource = scripts.inlineSources.join("\n");
  const problems: string[] = [];
  const sizes = new Map<string, number>();

  const sizeOf = (chunkPath: string): number => {
    const known = sizes.get(chunkPath);

    if (known !== undefined) return known;

    const gzipBytes = gzipBytesOf(readChunk(chunkPath) ?? "");

    sizes.set(chunkPath, gzipBytes);

    return gzipBytes;
  };

  const sourceOf = (chunkPath: string) =>
    chunkPath === INLINE_SCRIPT_PATH ? inlineSource : (readChunk(chunkPath) ?? "");

  const onDisk = (chunkPath: string) => readChunk(chunkPath) !== null;

  const loadedPaths = scripts.loadedUrls.flatMap((url) => {
    const chunkPath = chunkPathOf(url);

    if (chunkPath === null) return [];

    if (onDisk(chunkPath)) return [chunkPath];

    problems.push(`loads ${chunkPath}, which is not in the build output`);

    return [];
  });

  const firstLoadPaths = reachedFrom([INLINE_SCRIPT_PATH, ...loadedPaths], (chunkPath) =>
    staticImportPaths(chunkPath, sourceOf(chunkPath)).filter((importedPath) => {
      if (onDisk(importedPath)) return true;

      problems.push(`${chunkPath} imports ${importedPath}, which is not in the build output`);

      return false;
    }),
  ).filter((chunkPath) => chunkPath !== INLINE_SCRIPT_PATH);

  const firstLoad = new Set(firstLoadPaths);

  const lazyChunks = reachedFrom([INLINE_SCRIPT_PATH, ...firstLoadPaths], (chunkPath) =>
    mentionedPaths(chunkPath, sourceOf(chunkPath)).filter(onDisk),
  )
    .filter((chunkPath) => chunkPath !== INLINE_SCRIPT_PATH && !firstLoad.has(chunkPath))
    .map((chunkPath) => ({ chunkPath, gzipBytes: sizeOf(chunkPath) }))
    .toSorted((left, right) => right.gzipBytes - left.gzipBytes);

  for (const url of scripts.preloadedUrls) {
    const chunkPath = chunkPathOf(url);

    if (chunkPath === null) {
      problems.push(`preloads ${url.href}, a script from another origin`);
    } else if (!firstLoad.has(chunkPath)) {
      const size = onDisk(chunkPath) ? `${sizeOf(chunkPath)} B gzipped` : "not in the build output";

      problems.push(`preloads ${chunkPath} (${size}), which is not in its first-load JS`);
    }
  }

  const inlineGzipBytes = inlineSource === "" ? 0 : gzipBytesOf(inlineSource);

  return {
    firstLoadGzipBytes: firstLoadPaths.reduce(
      (total, chunkPath) => total + sizeOf(chunkPath),
      inlineGzipBytes,
    ),
    lazyGzipBytes: lazyChunks.reduce((total, chunk) => total + chunk.gzipBytes, 0),
    htmlGzipBytes: gzipBytesOf(html),
    lazyChunks,
    hasModuleScript: scripts.hasModuleScript,
    problems,
  };
}

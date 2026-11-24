export type PageScripts = {
  readonly inlineSources: readonly string[];
  readonly loadedUrls: readonly URL[];
  readonly preloadedUrls: readonly URL[];
  readonly hasModuleScript: boolean;
};

export const PAGE_ORIGIN = "http://localhost";

const EXECUTABLE_TYPES = new Set(["", "module", "text/javascript", "application/javascript"]);

function attributeOf(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(
    tag,
  );

  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function hasAttribute(tag: string, name: string): boolean {
  return new RegExp(`\\s${name}(?=[\\s=>/])`, "i").test(tag);
}

function tagsIn(html: string, element: string): string[] {
  return [...html.matchAll(new RegExp(`<${element}(?=[\\s>])[^>]*>`, "gi"))].map(([tag]) => tag);
}

function preloadedScriptUrls(html: string): URL[] {
  return tagsIn(html, "link").flatMap((tag) => {
    const relTokens = attributeOf(tag, "rel")?.toLowerCase().split(/\s+/) ?? [];
    const href = attributeOf(tag, "href");

    const isScriptPreload =
      relTokens.includes("modulepreload") ||
      (relTokens.includes("preload") && attributeOf(tag, "as")?.toLowerCase() === "script");

    return isScriptPreload && href !== undefined ? [new URL(href, PAGE_ORIGIN)] : [];
  });
}

export function readPageScripts(html: string): PageScripts {
  const inlineSources: string[] = [];
  const loadedUrls: URL[] = [];
  let hasModuleScript = false;

  for (const [, tag = "", body = ""] of html.matchAll(
    /(<script(?=[\s>])[^>]*>)([\s\S]*?)<\/script\s*>/gi,
  )) {
    const type = attributeOf(tag, "type")?.toLowerCase() ?? "";

    if (!EXECUTABLE_TYPES.has(type) || hasAttribute(tag, "nomodule")) continue;

    const src = attributeOf(tag, "src");

    if (type === "module") hasModuleScript = true;

    if (src === undefined) inlineSources.push(body);
    else loadedUrls.push(new URL(src, PAGE_ORIGIN));
  }

  return { inlineSources, loadedUrls, preloadedUrls: preloadedScriptUrls(html), hasModuleScript };
}

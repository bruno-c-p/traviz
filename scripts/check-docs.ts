import { execFileSync } from "node:child_process";
import { existsSync, globSync, readFileSync } from "node:fs";
import { basename, dirname, join, matchesGlob, resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";

const { values: options } = parseArgs({ options: { root: { type: "string" } } });
const root = resolve(options.root ?? join(import.meta.dirname, ".."));

const markdownUnderDocs = globSync("docs/**/*.md", { cwd: root }).filter(
  (document) => !document.startsWith("docs/plans/"),
);

const documents = ["AGENTS.md", "README.md", ...markdownUnderDocs.sort()];

const packageManifest = z
  .object({ scripts: z.record(z.string(), z.string()) })
  .parse(JSON.parse(readFileSync(join(root, "package.json"), "utf8")));

const packageScripts = Object.keys(packageManifest.scripts);
const moduleExtensions = ["", ".ts", ".tsx", ".js", ".json", "/index.ts", "/index.tsx"];

const prefixedPathPattern =
  /(?<![\w/.-])(?:@\/|(?:src|docs|scripts|tools|\.github)\/)[\w./@()[\]*-]+/g;

const backtickedFilePattern = /`([\w./@()[\]*-]+\.(?:ts|tsx|js|mjs|json|md|yml|yaml|css))`/g;
const linkTargetPattern = /\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;
const scriptPattern = /bun run ([\w:-]+)/g;

const repoFileNames = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  {
    cwd: root,
    encoding: "utf8",
  },
)
  .split("\n")
  .filter((filePath) => filePath !== "" && existsSync(join(root, filePath)))
  .map((filePath) => basename(filePath));

function bareNameResolves(reference: string): boolean {
  if (reference.includes("*")) return repoFileNames.some((name) => matchesGlob(name, reference));

  return repoFileNames.includes(reference);
}

function countOf(text: string, character: string): number {
  return text.split(character).length - 1;
}

function trimTrailingPunctuation(reference: string): string {
  let trimmed = reference.replace(/\.+$/, "");

  while (
    (trimmed.endsWith(")") && countOf(trimmed, ")") > countOf(trimmed, "(")) ||
    (trimmed.endsWith("]") && countOf(trimmed, "]") > countOf(trimmed, "["))
  ) {
    trimmed = trimmed.slice(0, -1).replace(/\.+$/, "");
  }

  return trimmed;
}

function pathExists(relativePath: string): boolean {
  if (relativePath.includes("*")) {
    return globSync(relativePath, { cwd: root }).length > 0;
  }

  return existsSync(join(root, relativePath));
}

function referenceResolves(reference: string): boolean {
  if (reference === "@/paths") return pathExists("paths.ts");

  if (!reference.includes("/")) return bareNameResolves(reference);

  const relativePath = reference.startsWith("@/") ? `src/${reference.slice(2)}` : reference;

  return moduleExtensions.some((extension) => pathExists(relativePath + extension));
}

function linkTargetResolves(document: string, target: string): boolean {
  const filePath = target.split("#")[0];

  return filePath === "" || existsSync(join(root, dirname(document), filePath));
}

function pathReferencesIn(line: string): Set<string> {
  const references = new Set<string>();

  for (const match of line.matchAll(prefixedPathPattern)) {
    references.add(trimTrailingPunctuation(match[0].split("](")[0]));
  }

  for (const match of line.matchAll(backtickedFilePattern)) {
    const reference = match[1].replace(/^\.\//, "");

    if (!reference.startsWith("node_modules/")) references.add(reference);
  }

  return references;
}

function linkTargetsIn(document: string, line: string, pathReferences: Set<string>): string[] {
  const isRootDocument = dirname(document) === ".";

  return [...line.matchAll(linkTargetPattern)].flatMap(([, target]) =>
    /^[a-z][a-z\d+.-]*:/i.test(target) ||
    (isRootDocument && target.includes("/") && pathReferences.has(target))
      ? []
      : [target],
  );
}

const failures: string[] = [];
let checkedCount = 0;

for (const document of documents) {
  const lines = readFileSync(join(root, document), "utf8").split("\n");

  for (const [index, line] of lines.entries()) {
    const location = `${document}:${index + 1}`;
    const lineWithoutUrls = line.replace(/https?:\/\/[^\s)]+/g, "");
    const pathReferences = pathReferencesIn(lineWithoutUrls);

    for (const reference of pathReferences) {
      checkedCount += 1;

      if (!referenceResolves(reference)) failures.push(`${location} path ${reference}`);
    }

    for (const target of linkTargetsIn(document, lineWithoutUrls, pathReferences)) {
      checkedCount += 1;

      if (!linkTargetResolves(document, target)) failures.push(`${location} link ${target}`);
    }

    for (const match of line.matchAll(scriptPattern)) {
      checkedCount += 1;

      if (!packageScripts.includes(match[1])) failures.push(`${location} script ${match[1]}`);
    }
  }
}

console.log(`${documents.length} documents, ${checkedCount} references, ${failures.length} broken`);

if (failures.length > 0) console.log(failures.join("\n"));

process.exit(failures.length > 0 ? 1 : 0);

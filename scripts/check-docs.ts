import { existsSync, globSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values: options } = parseArgs({ options: { root: { type: "string" } } });
const root = resolve(options.root ?? join(import.meta.dirname, ".."));

const markdownUnderDocs = globSync("docs/**/*.md", { cwd: root }).filter(
  (document) => !document.startsWith("docs/plans/"),
);

const documents = ["AGENTS.md", "README.md", ...markdownUnderDocs.sort()];

const packageScripts = Object.keys(
  JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts,
);

const moduleExtensions = ["", ".ts", ".tsx", ".js", ".json", "/index.ts", "/index.tsx"];

function pathExists(relativePath: string): boolean {
  if (relativePath.includes("*")) {
    return globSync(relativePath, { cwd: root }).length > 0;
  }

  return existsSync(join(root, relativePath));
}

function referenceResolves(reference: string): boolean {
  if (reference === "@/paths") return pathExists("paths.ts");

  const relativePath = reference.startsWith("@/") ? `src/${reference.slice(2)}` : reference;

  return moduleExtensions.some((extension) => pathExists(relativePath + extension));
}

function linkTargetResolves(document: string, target: string): boolean {
  const filePath = target.split("#")[0];

  return filePath === "" || existsSync(join(root, dirname(document), filePath));
}

const failures: string[] = [];
let checkedCount = 0;

for (const document of documents) {
  const lines = readFileSync(join(root, document), "utf8").split("\n");

  for (const [index, line] of lines.entries()) {
    const location = `${document}:${index + 1}`;
    const lineWithoutUrls = line.replace(/https?:\/\/[^\s)]+/g, "");

    for (const match of lineWithoutUrls.matchAll(
      /(?<![\w/.-])(?:@\/|(?:src|docs|scripts|tools|\.github)\/)[\w./@()[\]*-]+/g,
    )) {
      const reference = match[0]
        .split("](")[0]
        .replace(/[.)\]]+$/, "")
        .replace(/(?<=.)\/$/, "");

      checkedCount += 1;

      if (!referenceResolves(reference)) failures.push(`${location} path ${reference}`);
    }

    for (const match of lineWithoutUrls.matchAll(/\]\(([^)\s]+)\)/g)) {
      checkedCount += 1;

      if (!linkTargetResolves(document, match[1])) failures.push(`${location} link ${match[1]}`);
    }

    for (const match of line.matchAll(/bun run ([\w:-]+)/g)) {
      checkedCount += 1;

      if (!packageScripts.includes(match[1])) failures.push(`${location} script ${match[1]}`);
    }
  }
}

console.log(`${documents.length} documents, ${checkedCount} references, ${failures.length} broken`);

if (failures.length > 0) console.log(failures.join("\n"));

process.exit(failures.length > 0 ? 1 : 0);

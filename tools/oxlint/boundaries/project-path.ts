import { posix, relative, resolve, sep } from "node:path";

import type { Context, ESTree } from "@oxlint/plugins";

export const repoRoot = resolve(import.meta.dirname, "..", "..", "..");

export function projectPath(context: Context): string {
  return relative(repoRoot, context.filename).split(sep).join("/");
}

export function isTestPath(path: string): boolean {
  return /\.test\.tsx?$/.test(path) || path.startsWith("src/shared/testing/");
}

export function hasDirective(program: ESTree.Program, directive: string): boolean {
  return program.body.some(
    (statement) => statement.type === "ExpressionStatement" && statement.directive === directive,
  );
}

export function firstStatement(program: ESTree.Program): ESTree.Node | undefined {
  return program.body.find(
    (statement) => statement.type !== "ExpressionStatement" || !statement.directive,
  );
}

export type ModuleSourceNode =
  | ESTree.ImportDeclaration
  | ESTree.ExportNamedDeclaration
  | ESTree.ExportAllDeclaration
  | ESTree.ImportExpression;

function sourceText(source: ESTree.Expression | null): string | null {
  if (source?.type === "Literal") return String(source.value);

  if (source?.type === "TemplateLiteral" && source.expressions.length === 0)
    return source.quasis[0]?.value.cooked ?? null;

  return null;
}

function normalizeAliasedSource(source: string): string {
  const sourcePath = posix.normalize(`src/${source.slice("@/".length)}`);

  return sourcePath.startsWith("src/") ? `@/${sourcePath.slice("src/".length)}` : sourcePath;
}

export function moduleSource(node: ModuleSourceNode): string | null {
  const source = sourceText(node.source);

  return source?.startsWith("@/") ? normalizeAliasedSource(source) : source;
}

export function isTypeOnly(node: ModuleSourceNode): boolean {
  if (node.type === "ImportDeclaration") return node.importKind === "type";

  if (node.type === "ImportExpression") return false;

  return node.exportKind === "type";
}

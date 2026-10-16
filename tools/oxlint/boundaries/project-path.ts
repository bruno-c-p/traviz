import { relative, sep } from "node:path";

import type { Context, ESTree } from "@oxlint/plugins";

export function projectPath(context: Context): string {
  return relative(context.cwd, context.filename).split(sep).join("/");
}

export function isTestPath(path: string): boolean {
  return /\.test\.tsx?$/.test(path) || path.startsWith("src/shared/testing/");
}

export function hasDirective(program: ESTree.Program, directive: string): boolean {
  return program.body.some(
    (statement) => statement.type === "ExpressionStatement" && statement.directive === directive,
  );
}

export type ModuleSourceNode =
  | ESTree.ImportDeclaration
  | ESTree.ExportNamedDeclaration
  | ESTree.ExportAllDeclaration
  | ESTree.ImportExpression;

export function moduleSource(node: ModuleSourceNode): string | null {
  const source = node.source;

  if (source === null || source.type !== "Literal") return null;

  return String(source.value);
}

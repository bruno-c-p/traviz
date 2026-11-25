import { defineRule } from "@oxlint/plugins";

import {
  firstStatement,
  isTestPath,
  isTypeOnly,
  moduleSource,
  projectPath,
} from "./project-path.ts";

import type { ESTree } from "@oxlint/plugins";
import type { ModuleSourceNode } from "./project-path.ts";

const serverPackagePattern = /^(?:zod|@libsql\/client|@clerk\/backend)(?:\/.*)?$/;
const bunModulePattern = /^bun(?::.*)?$/;

function isServerModule(program: ESTree.Program): boolean {
  const leadingStatement = firstStatement(program);

  return (
    leadingStatement?.type === "ImportDeclaration" &&
    leadingStatement.specifiers.length === 0 &&
    leadingStatement.source.value === "server-only"
  );
}

export const serverOnlyModuleRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Keep server packages in server modules, and Bun APIs out of the app, which runs on Node.",
    },
    messages: {
      serverPackage:
        '"{{source}}" belongs on the server. Import it from a module that starts with import "server-only".',
      bunModule:
        'The app runs on Node in production. Import "{{source}}" only in tests, src/shared/testing and scripts.',
    },
  },
  create(context) {
    const path = projectPath(context);
    let serverModule = false;

    function checkSource(node: ModuleSourceNode) {
      const source = moduleSource(node);

      if (source === null || isTypeOnly(node)) return;

      if (bunModulePattern.test(source)) {
        context.report({ node, messageId: "bunModule", data: { source } });

        return;
      }

      if (!serverModule && serverPackagePattern.test(source))
        context.report({ node, messageId: "serverPackage", data: { source } });
    }

    if (!path.startsWith("src/") || isTestPath(path)) return {};

    return {
      Program(node) {
        serverModule = isServerModule(node);
      },
      ImportDeclaration: checkSource,
      ExportNamedDeclaration: checkSource,
      ExportAllDeclaration: checkSource,
      ImportExpression: checkSource,
    };
  },
});

import { defineRule } from "@oxlint/plugins";

import { isTestPath, isTypeOnly, moduleSource, projectPath } from "./project-path.ts";

import type { ESTree } from "@oxlint/plugins";

const endpointFilePattern = /^src\/pages\/.+(?<!\.d)\.ts$/;
const apiRoutePattern = /^src\/pages\/api\/.+\.ts$/;
const featureServerPattern = /^@\/features\/[^/]+\/server$/;
const handlerNamePattern = /^handle[A-Z]/;

function nameOf(node: ESTree.ModuleExportName): string {
  return node.type === "Literal" ? String(node.value) : node.name;
}

function declaredNames(declaration: ESTree.ExportNamedDeclaration["declaration"]): string[] {
  if (declaration === null) return [];

  if (declaration.type === "VariableDeclaration")
    return declaration.declarations.map(({ id }) => (id.type === "Identifier" ? id.name : ""));

  if (declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration")
    return [declaration.id?.name ?? ""];

  return [];
}

function isTypeDeclaration(node: ESTree.ExportNamedDeclaration): boolean {
  return (
    node.exportKind === "type" ||
    node.declaration?.type === "TSTypeAliasDeclaration" ||
    node.declaration?.type === "TSInterfaceDeclaration"
  );
}

export const apiRouteRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Keep endpoints in src/pages/api, each one a POST that only calls a feature's server entry, and keep the handle* functions of a server entry out of every other module.",
    },
    messages: {
      misplaced:
        "{{path}} is an endpoint outside src/pages/api. Put each data change in src/pages/api/<feature>/<verb>.ts.",
      notPost:
        "An API route exports only POST. A data change behind another method, or another export, is a second way in. Remove {{name}}.",
      foreignImport:
        'An API route only calls a feature\'s server entry, where the user check and the input validation live. Import from "@/features/<name>/server", not "{{source}}".',
      handlerOutsideApi:
        '{{name}} answers a request that changes or reads a user\'s data. Only a route in src/pages/api may import it from "{{source}}".',
      namespaceOutsideApi:
        'A namespace import of "{{source}}" hides which handle* functions this module reaches. Import the names it needs.',
    },
  },
  create(context) {
    const path = projectPath(context);

    if (!path.startsWith("src/") || isTestPath(path)) return {};

    if (!apiRoutePattern.test(path)) {
      const reportHandler = (node: ESTree.Node, name: string, source: string) => {
        if (handlerNamePattern.test(name))
          context.report({ node, messageId: "handlerOutsideApi", data: { name, source } });
      };

      return {
        Program(node) {
          if (endpointFilePattern.test(path))
            context.report({ node, messageId: "misplaced", data: { path } });
        },
        ImportDeclaration(node) {
          const source = moduleSource(node);

          if (source === null || isTypeOnly(node) || !featureServerPattern.test(source)) return;

          for (const specifier of node.specifiers) {
            if (specifier.type === "ImportNamespaceSpecifier")
              context.report({ node, messageId: "namespaceOutsideApi", data: { source } });
            else if (specifier.type === "ImportSpecifier")
              reportHandler(specifier, nameOf(specifier.imported), source);
          }
        },
        ExportNamedDeclaration(node) {
          const source = moduleSource(node);

          if (source === null || !featureServerPattern.test(source)) return;

          for (const specifier of node.specifiers)
            reportHandler(specifier, nameOf(specifier.local), source);
        },
        ExportAllDeclaration(node) {
          const source = moduleSource(node);

          if (source !== null && featureServerPattern.test(source))
            context.report({ node, messageId: "namespaceOutsideApi", data: { source } });
        },
      };
    }

    const reportExport = (node: ESTree.Node, name: string) => {
      if (name !== "POST") context.report({ node, messageId: "notPost", data: { name } });
    };

    return {
      ImportDeclaration(node) {
        const source = moduleSource(node);

        if (source === null || isTypeOnly(node) || featureServerPattern.test(source)) return;

        context.report({ node, messageId: "foreignImport", data: { source } });
      },
      ImportExpression(node) {
        const source = moduleSource(node) ?? "a computed path";

        if (!featureServerPattern.test(source))
          context.report({ node, messageId: "foreignImport", data: { source } });
      },
      ExportNamedDeclaration(node) {
        if (isTypeDeclaration(node)) return;

        for (const name of declaredNames(node.declaration)) reportExport(node, name);

        for (const specifier of node.specifiers)
          reportExport(specifier, nameOf(specifier.exported));
      },
      ExportDefaultDeclaration(node) {
        reportExport(node, "the default export");
      },
      ExportAllDeclaration(node) {
        reportExport(node, "export *");
      },
    };
  },
});

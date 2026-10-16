import { defineRule } from "@oxlint/plugins";

import { isTypeOnly, moduleSource } from "./project-path.ts";

import type { ModuleSourceNode } from "./project-path.ts";

const sideEffectModulePattern = /(?:\.css|^server-only|^client-only)$/;

export const noEmptyImportRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow import {} from and export {} from, which run a module only for its side effects.",
    },
    messages: {
      emptyImport:
        'An import that binds no name runs "{{source}}" only for its side effects, and the bundler can drop it under package.json sideEffects. Import a name, or delete the import.',
    },
  },
  create(context) {
    function checkSource(node: ModuleSourceNode, specifierCount: number) {
      const source = moduleSource(node);

      if (source === null || specifierCount > 0 || isTypeOnly(node)) return;

      if (sideEffectModulePattern.test(source)) return;

      context.report({ node, messageId: "emptyImport", data: { source } });
    }

    return {
      ImportDeclaration(node) {
        if (/^import\s*\{/.test(context.sourceCode.getText(node)))
          checkSource(node, node.specifiers.length);
      },
      ExportNamedDeclaration(node) {
        if (node.source !== null && node.declaration === null)
          checkSource(node, node.specifiers.length);
      },
    };
  },
});

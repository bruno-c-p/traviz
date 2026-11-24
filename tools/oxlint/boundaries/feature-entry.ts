import { defineRule } from "@oxlint/plugins";

import { moduleSource, projectPath } from "./project-path.ts";

import type { ModuleSourceNode } from "./project-path.ts";

const featureImportPattern = /^@\/features\/([^/]+)(?:\/(.*))?$/;
const featureFilePattern = /^src\/features\/([^/]+)\/./;
const entrySubpathPattern = /^(?:core|server|[^/]+\.(?:astro|css))$/;

const allowedSourceLocations = [
  /^src\/pages\//,
  featureFilePattern,
  /^src\/shared\//,
  /^src\/middleware\.ts$/,
  /^src\/env\.d\.ts$/,
];

function isAllowedLocation(path: string): boolean {
  return !path.startsWith("src/") || allowedSourceLocations.some((pattern) => pattern.test(path));
}

export const featureEntryRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Keep src to pages, features, shared, middleware.ts and env.d.ts, and import a feature only through its entry.",
    },
    messages: {
      strayFile:
        "{{path}} sits outside src/pages, src/features/<name>, src/shared, src/middleware.ts and src/env.d.ts. Move it into the feature that owns it, or into src/shared.",
      deepImport:
        'Import {{feature}} through "@/features/{{feature}}", "@/features/{{feature}}/core", "@/features/{{feature}}/server" or one of its .astro or .css files, not "{{source}}".',
      sharedImportsFeature:
        'src/shared imports no feature. Move the code that needs "{{source}}" into a feature.',
    },
  },
  create(context) {
    const path = projectPath(context);
    const importerFeature = featureFilePattern.exec(path)?.[1] ?? null;
    const isShared = path.startsWith("src/shared/");

    function checkSource(node: ModuleSourceNode) {
      const source = moduleSource(node);
      const match = source === null ? null : featureImportPattern.exec(source);

      if (source === null || match === null) return;

      const [, feature, subpath] = match;

      if (isShared) {
        context.report({ node, messageId: "sharedImportsFeature", data: { source } });

        return;
      }

      if (subpath === undefined || entrySubpathPattern.test(subpath) || feature === importerFeature)
        return;

      context.report({ node, messageId: "deepImport", data: { feature, source } });
    }

    return {
      Program(node) {
        if (!isAllowedLocation(path))
          context.report({ node, messageId: "strayFile", data: { path } });
      },
      ImportDeclaration: checkSource,
      ExportNamedDeclaration: checkSource,
      ExportAllDeclaration: checkSource,
      ImportExpression: checkSource,
      TSImportType: checkSource,
    };
  },
});

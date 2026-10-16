import { defineRule } from "@oxlint/plugins";

import { moduleSource, projectPath } from "./project-path.ts";

import type { ModuleSourceNode } from "./project-path.ts";

const featureImportPattern = /^@\/features\/([^/]+)(?:\/(.*))?$/;
const featureFilePattern = /^src\/features\/([^/]+)\/./;
const entrySubpathPattern = /^(?:server|actions\/[^/.]+)$/;

const allowedSourceLocations = [
  /^src\/app\//,
  featureFilePattern,
  /^src\/shared\//,
  /^src\/proxy\.ts$/,
];

function isAllowedLocation(path: string): boolean {
  return !path.startsWith("src/") || allowedSourceLocations.some((pattern) => pattern.test(path));
}

export const featureEntryRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Keep src to app, features, shared and proxy.ts, and import a feature only through its entry.",
    },
    messages: {
      strayFile:
        "{{path}} sits outside src/app, src/features/<name>, src/shared and src/proxy.ts. Move it into the feature that owns it, or into src/shared.",
      deepImport:
        'Import {{feature}} through "@/features/{{feature}}", "@/features/{{feature}}/server" or "@/features/{{feature}}/actions/<verb>", not "{{source}}".',
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

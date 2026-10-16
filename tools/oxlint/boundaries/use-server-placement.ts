import { defineRule } from "@oxlint/plugins";

import { hasDirective, isTestPath, projectPath } from "./project-path.ts";

const actionFilePattern = /^src\/features\/[^/]+\/actions\/[^/]+\.ts$/;

export const useServerPlacementRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        'Allow "use server" only at the top of src/features/<name>/actions/<verb>.ts, and require it there.',
    },
    messages: {
      misplaced:
        '"use server" turns every export into a public endpoint. Put each action in src/features/<name>/actions/<verb>.ts and keep this module server-only.',
      missing:
        'An action file starts with "use server". Move code that is not an action out of src/features/<name>/actions.',
    },
  },
  create(context) {
    const path = projectPath(context);
    const isActionFile = actionFilePattern.test(path) && !isTestPath(path);

    return {
      Program(node) {
        if (isActionFile && !hasDirective(node, "use server"))
          context.report({ node, messageId: "missing" });
      },
      ExpressionStatement(node) {
        if (node.directive !== "use server") return;

        if (isActionFile && node.parent.type === "Program") return;

        context.report({ node, messageId: "misplaced" });
      },
    };
  },
});

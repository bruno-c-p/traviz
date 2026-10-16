import { defineRule } from "@oxlint/plugins";

export const noCommentsRule = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Disallow comments. Name things so the code explains itself." },
    messages: {
      comment:
        "Delete this comment. Name things so the code explains itself, and move a constraint into a type, a test or AGENTS.md.",
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments())
          context.report({ loc: comment.loc, messageId: "comment" });
      },
    };
  },
});

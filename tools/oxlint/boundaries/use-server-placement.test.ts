import { useServerPlacementRule } from "./use-server-placement.ts";
import { at, tester } from "./rule-tester.ts";

tester.run("boundaries/use-server-placement", useServerPlacementRule, {
  valid: [
    at(
      "src/features/marks/actions/set-mark.ts",
      '"use server";\nexport async function setMarkAction() {}',
    ),
    at("src/features/marks/actions/set-mark.test.ts", 'import { test } from "bun:test";'),
    at(
      "src/features/marks/services/marks.ts",
      'import "server-only";\nexport async function upsertMarkForUser() {}',
    ),
    at("src/features/marks/marks-store.ts", '"use client";\nexport const store = 1;'),
    at("src/app/(app)/page.tsx", 'const label = "use server";'),
  ],
  invalid: [
    {
      name: 'Q21: "use server" added to the marks repository',
      ...at(
        "src/features/marks/services/marks.ts",
        '"use server";\nimport "server-only";\nexport async function upsertMarkForUser() {}',
      ),
      errors: [{ messageId: "misplaced" }],
    },
    {
      name: "an inline server action in a route",
      ...at(
        "src/app/(app)/stats/page.tsx",
        'export default function Page() {\n  async function reset() {\n    "use server";\n  }\n  return reset;\n}',
      ),
      errors: [{ messageId: "misplaced" }],
    },
    {
      name: "an inline directive inside an action file",
      ...at(
        "src/features/marks/actions/clear-mark.ts",
        '"use server";\nexport async function clearMarkAction() {\n  "use server";\n}',
      ),
      errors: [{ messageId: "misplaced" }],
    },
    {
      name: "a nested actions folder",
      ...at(
        "src/features/marks/actions/internal/apply.ts",
        '"use server";\nexport async function apply() {}',
      ),
      errors: [{ messageId: "misplaced" }],
    },
    {
      name: 'an action file without "use server"',
      ...at("src/features/marks/actions/set-mark.ts", "export async function setMarkAction() {}"),
      errors: [{ messageId: "missing" }],
    },
  ],
});

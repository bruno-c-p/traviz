import { RuleTester } from "oxlint/plugins-dev";

import { featureEntryRule } from "./feature-entry.ts";

const repoRoot = "/repo";
const tester = new RuleTester({ cwd: repoRoot });

function at(path: string, code: string) {
  return { code, filename: `${repoRoot}/${path}` };
}

tester.run("boundaries/feature-entry", featureEntryRule, {
  valid: [
    at("src/app/(app)/page.tsx", 'import { GlobeOverlay } from "@/features/globe";'),
    at("src/app/(app)/layout.tsx", 'import { SessionLayer } from "@/features/app-shell/server";'),
    at(
      "src/features/marks/marks-store.ts",
      'import { setMarkAction } from "@/features/marks/actions/set-mark";',
    ),
    at(
      "src/features/globe/country-card.tsx",
      'import { setMarkAction } from "@/features/marks/actions/set-mark";',
    ),
    at(
      "src/features/auth/email-link-form.tsx",
      'import { forgetStoredMarks } from "@/features/marks";',
    ),
    at(
      "src/features/marks/index.ts",
      'export { useCountriesStore } from "@/features/marks/marks-store";',
    ),
    at(
      "src/features/marks/marks-provider.tsx",
      'const services = await import("@/features/marks/services/marks");',
    ),
    at("src/proxy.ts", 'import { signInPath } from "@/paths";'),
    at("src/shared/cn.ts", 'import { clsx } from "clsx";'),
    at("src/shared/testing/check-docs.test.ts", 'import { expect } from "bun:test";'),
    at("scripts/migrate.ts", 'import { createMarksTable } from "@/features/marks/server";'),
  ],
  invalid: [
    {
      name: "f63b92b: email-link-form imports marks storage by its file path",
      ...at(
        "src/features/auth/email-link-form.tsx",
        'import { forgetStoredMarks } from "@/features/marks/marks-storage";',
      ),
      errors: [{ messageId: "deepImport" }],
    },
    {
      name: "C5: a file in src/components",
      ...at("src/components/country-row.tsx", "export function CountryRow() { return null; }"),
      errors: [{ messageId: "strayFile" }],
    },
    {
      name: "a file directly in src/features",
      ...at("src/features/helpers.ts", "export const helper = 1;"),
      errors: [{ messageId: "strayFile" }],
    },
    {
      name: "a file in src next to proxy.ts",
      ...at("src/middleware.ts", "export const config = {};"),
      errors: [{ messageId: "strayFile" }],
    },
    {
      name: "a route imports a store file",
      ...at(
        "src/app/(app)/list/page.tsx",
        'import { useCountriesStore } from "@/features/marks/marks-store";',
      ),
      errors: [{ messageId: "deepImport" }],
    },
    {
      name: "a re-export and a dynamic import of another feature's file",
      ...at(
        "src/features/globe/index.ts",
        'export { STATE_COLORS } from "@/features/marks/colors";\nexport * from "@/features/stats/stats";\nconst store = import("@/features/marks/marks-store");',
      ),
      errors: [
        { messageId: "deepImport" },
        { messageId: "deepImport" },
        { messageId: "deepImport" },
      ],
    },
    {
      name: "a nested path under actions",
      ...at(
        "src/features/globe/country-card.tsx",
        'import { helper } from "@/features/marks/actions/shared/helper";',
      ),
      errors: [{ messageId: "deepImport" }],
    },
    {
      name: "a script imports a feature's file",
      ...at(
        "scripts/migrate.ts",
        'import { createMarksTable } from "@/features/marks/services/marks";',
      ),
      errors: [{ messageId: "deepImport" }],
    },
    {
      name: "src/shared imports a feature",
      ...at("src/shared/brand-mark.tsx", 'import { STATE_COLORS } from "@/features/marks";'),
      errors: [{ messageId: "sharedImportsFeature" }],
    },
  ],
});

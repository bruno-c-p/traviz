import { featureEntryRule } from "./feature-entry.ts";
import { at, tester } from "./rule-tester.ts";

tester.run("boundaries/feature-entry", featureEntryRule, {
  valid: [
    at("src/pages/index.astro", 'import { mountGlobeView } from "@/features/globe";'),
    at("src/pages/list.astro", 'import { loadUserMarks } from "@/features/marks/server";'),
    at("src/pages/list.astro", 'import ListView from "@/features/country-list/list-view.astro";'),
    at("src/pages/404.astro", 'import "@/features/landing/landing.css";'),
    at(
      "src/features/app-shell/top-bar.astro",
      'import AccountButton from "@/features/auth/account-button.astro";',
    ),
    at(
      "src/pages/api/marks/apply.ts",
      'import { handleMarkChange } from "@/features/marks/server";',
    ),
    at("src/middleware.ts", 'import { authenticateRequest } from "@/features/auth/server";'),
    at("src/env.d.ts", "declare namespace App {}"),
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
    at("src/features/stats/stats.ts", 'import type { Marks } from "@/features/marks";'),
    at(
      "src/features/landing/render-landing.ts",
      'import { tallyMarks } from "@/features/marks/core";',
    ),
    at("src/pages/welcome.astro", 'import { THEME_SCRIPT } from "@/features/theme/core";'),
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
      name: "a file in src next to middleware.ts",
      ...at("src/proxy.ts", "export const config = {};"),
      errors: [{ messageId: "strayFile" }],
    },
    {
      name: "a file in the retired src/app",
      ...at("src/app/layout.tsx", "export const metadata = {};"),
      errors: [{ messageId: "strayFile" }],
    },
    {
      name: "an action import, which the API routes replaced",
      ...at(
        "src/features/globe/globe-view.ts",
        'import { setMarkAction } from "@/features/marks/actions/set-mark";',
      ),
      errors: [{ messageId: "deepImport" }],
    },
    {
      name: "an .astro file in a nested directory of another feature",
      ...at("src/pages/list.astro", 'import Row from "@/features/country-list/rows/row.astro";'),
      errors: [{ messageId: "deepImport" }],
    },
    {
      name: "a route imports a store file",
      ...at(
        "src/pages/list.astro",
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
    {
      name: "a dot segment that leaves the importer's feature",
      ...at(
        "src/features/auth/email-link-form.tsx",
        'import { forgetStoredMarks } from "@/features/auth/../marks/marks-storage";',
      ),
      errors: [{ messageId: "deepImport" }],
    },
    {
      name: "an import type of another feature's file",
      ...at("src/features/stats/stats.ts", 'import type { Marks } from "@/features/marks/colors";'),
      errors: [{ messageId: "deepImport" }],
    },
    {
      name: "a TypeScript import type of another feature's file",
      ...at("src/features/stats/stats.ts", 'type Marks = import("@/features/marks/colors").Marks;'),
      errors: [{ messageId: "deepImport" }],
    },
    {
      name: "a dot segment right after the alias",
      ...at(
        "src/features/globe/country-card.tsx",
        'import { useCountriesStore } from "@/../src/features/marks/marks-store";',
      ),
      errors: [{ messageId: "deepImport" }],
    },
    {
      name: "a template literal dynamic import of another feature's file",
      ...at("src/pages/index.astro", "const store = import(`@/features/marks/marks-store`);"),
      errors: [{ messageId: "deepImport" }],
    },
    {
      name: "an action path with an extension",
      ...at(
        "src/features/globe/country-card.tsx",
        'import { setMarkAction } from "@/features/marks/actions/set-mark.ts";',
      ),
      errors: [{ messageId: "deepImport" }],
    },
  ],
});

import { noEmptyImportRule } from "./no-empty-import.ts";
import { at, tester } from "./rule-tester.ts";

const error = { messageId: "emptyImport" };

tester.run("boundaries/no-empty-import", noEmptyImportRule, {
  valid: [
    at("src/shared/cn.ts", 'import { clsx } from "clsx";'),
    at("src/shared/cn.ts", 'import "server-only";'),
    at("src/app/layout.tsx", 'import {} from "./globals.css";'),
    at("src/features/marks/schemas.ts", 'import {} from "server-only";'),
    at("src/features/marks/marks-store.ts", 'import {} from "client-only";'),
    at("src/features/stats/stats.ts", 'import type {} from "@/features/marks";'),
    at("src/features/marks/index.ts", 'export { STATE_COLORS } from "@/features/marks/colors";'),
    at("src/features/stats/stats.ts", "export {};"),
  ],
  invalid: [
    {
      name: "an empty import of a local module",
      ...at("src/shared/cn.ts", 'import {} from "@/shared/register-x";'),
      errors: [error],
    },
    {
      name: "an empty import of a server entry in a client file",
      ...at(
        "src/features/marks/danger-zone.tsx",
        '"use client";\nimport {} from "@/features/marks/server";',
      ),
      errors: [error],
    },
    {
      name: "an empty import of a package",
      ...at("src/features/globe/map-canvas.tsx", 'import {} from "mapbox-gl";'),
      errors: [error],
    },
    {
      name: "an empty re-export",
      ...at("src/features/marks/index.ts", 'export {} from "@/features/marks/marks-storage";'),
      errors: [error],
    },
  ],
});

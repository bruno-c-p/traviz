import { serverOnlyModuleRule } from "./server-only-module.ts";
import { at, tester } from "./rule-tester.ts";

tester.run("boundaries/server-only-module", serverOnlyModuleRule, {
  valid: [
    at("src/features/marks/schemas.ts", 'import "server-only";\nimport { z } from "zod";'),
    at(
      "src/shared/server/database.ts",
      'import "server-only";\nimport { createClient } from "@libsql/client";',
    ),
    at(
      "src/features/auth/clerk-session-reader.ts",
      'import "server-only";\nimport { createClerkClient } from "@clerk/backend";',
    ),
    at("src/features/auth/clerk-session.ts", 'import type { Clerk } from "@clerk/shared/types";'),
    at("src/middleware.ts", 'import { authenticateRequest } from "@/features/auth/server";'),
    at(
      "src/features/marks/schemas.test.ts",
      'import { z } from "zod";\nimport { test } from "bun:test";',
    ),
    at("src/features/countries/country-data.test.ts", 'import { expect } from "bun:test";'),
    at("src/shared/testing/server-only-preload.ts", 'import { plugin } from "bun";'),
    at("scripts/check-gates.ts", 'import { z } from "zod";\nimport { $ } from "bun";'),
    at("src/features/globe/tileset-feature.ts", 'import type { ZodType } from "zod";'),
    at("src/features/marks/colors.ts", 'export type { Client } from "@libsql/client";'),
    at("src/features/countries/countries.ts", 'import type { BunFile } from "bun";'),
    at(
      "src/features/marks/marks-api.ts",
      '"use strict";\nimport "server-only";\nimport { z } from "zod";',
    ),
  ],
  invalid: [
    {
      name: "642f90f: zod in a client module",
      ...at(
        "src/features/globe/tileset-feature.ts",
        'import type { GeoJSONFeature } from "mapbox-gl";\nimport { z } from "zod";',
      ),
      errors: [{ messageId: "serverPackage" }],
    },
    {
      name: "a zod subpath and a re-export in a client module",
      ...at(
        "src/features/stats/stats.ts",
        'import { z } from "zod/mini";\nexport { createClient } from "@libsql/client/web";',
      ),
      errors: [{ messageId: "serverPackage" }, { messageId: "serverPackage" }],
    },
    {
      name: "Clerk's backend SDK in client code",
      ...at(
        "src/features/auth/keep-clerk-session.ts",
        'import { createClerkClient } from "@clerk/backend";',
      ),
      errors: [{ messageId: "serverPackage" }],
    },
    {
      name: "a Clerk backend subpath in the middleware, which is not a server-only module",
      ...at("src/middleware.ts", 'import { verifyToken } from "@clerk/backend/jwt";'),
      errors: [{ messageId: "serverPackage" }],
    },
    {
      name: 'a "use server" directive no longer makes a server module',
      ...at("src/features/marks/set-mark.ts", '"use server";\nimport { z } from "zod";'),
      errors: [{ messageId: "serverPackage" }],
    },
    {
      name: "zod in an API route",
      ...at("src/pages/api/marks/apply.ts", 'import { z } from "zod";'),
      errors: [{ messageId: "serverPackage" }],
    },
    {
      name: "a namespace import of server-only does not make a server module",
      ...at(
        "src/features/marks/colors.ts",
        'import * as guard from "server-only";\nimport { z } from "zod";',
      ),
      errors: [{ messageId: "serverPackage" }],
    },
    {
      name: "bun in app code",
      ...at("src/features/countries/countries.ts", 'import { file } from "bun";'),
      errors: [{ messageId: "bunModule" }],
    },
    {
      name: "bun:sqlite in a server-only module",
      ...at(
        "src/shared/server/database.ts",
        'import "server-only";\nimport { Database } from "bun:sqlite";',
      ),
      errors: [{ messageId: "bunModule" }],
    },
    {
      name: "a dynamic bun import in a route",
      ...at("src/pages/api/marks/read.ts", 'const bun = await import("bun");'),
      errors: [{ messageId: "bunModule" }],
    },
    {
      name: "a star re-export of zod",
      ...at("src/features/marks/colors.ts", 'export * from "zod";'),
      errors: [{ messageId: "serverPackage" }],
    },
    {
      name: "a star re-export of bun",
      ...at("src/features/countries/countries.ts", 'export * from "bun";'),
      errors: [{ messageId: "bunModule" }],
    },
    {
      name: "server-only imported after the server package",
      ...at("src/features/marks/colors.ts", 'import { z } from "zod";\nimport "server-only";'),
      errors: [{ messageId: "serverPackage" }],
    },
    {
      name: "an inline type specifier keeps the import at runtime",
      ...at("src/features/globe/tileset-feature.ts", 'import { type ZodType } from "zod";'),
      errors: [{ messageId: "serverPackage" }],
    },
    {
      name: "a template literal dynamic import of zod",
      ...at("src/features/globe/tileset-feature.ts", "const zod = await import(`zod`);"),
      errors: [{ messageId: "serverPackage" }],
    },
  ],
});

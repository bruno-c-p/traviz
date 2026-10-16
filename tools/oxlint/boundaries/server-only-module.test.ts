import { RuleTester } from "oxlint/plugins-dev";

import { serverOnlyModuleRule } from "./server-only-module.ts";

const repoRoot = "/repo";
const tester = new RuleTester({ cwd: repoRoot });

function at(path: string, code: string) {
  return { code, filename: `${repoRoot}/${path}` };
}

tester.run("boundaries/server-only-module", serverOnlyModuleRule, {
  valid: [
    at("src/features/marks/schemas.ts", 'import "server-only";\nimport { z } from "zod";'),
    at(
      "src/shared/server/database.ts",
      'import "server-only";\nimport { createClient } from "@libsql/client";',
    ),
    at(
      "src/features/auth/server.ts",
      'import "server-only";\nimport { auth } from "@clerk/nextjs/server";',
    ),
    at("src/features/marks/actions/set-mark.ts", '"use server";\nimport { z } from "zod";'),
    at("src/proxy.ts", 'import { clerkMiddleware } from "@clerk/nextjs/server";'),
    at("src/features/globe/map-canvas.tsx", 'import { useAuth } from "@clerk/nextjs";'),
    at(
      "src/features/marks/schemas.test.ts",
      'import { z } from "zod";\nimport { test } from "bun:test";',
    ),
    at("src/features/countries/country-data.test.tsx", 'import { expect } from "bun:test";'),
    at("src/shared/testing/server-only-preload.ts", 'import { plugin } from "bun";'),
    at("scripts/check-gates.ts", 'import { z } from "zod";\nimport { $ } from "bun";'),
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
      name: "Clerk's server API in a client component",
      ...at(
        "src/features/auth/account-button.tsx",
        '"use client";\nimport { auth } from "@clerk/nextjs/server";',
      ),
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
      ...at("src/app/(app)/page.tsx", 'const bun = await import("bun");'),
      errors: [{ messageId: "bunModule" }],
    },
  ],
});

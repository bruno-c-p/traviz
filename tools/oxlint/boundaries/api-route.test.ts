import { apiRouteRule } from "./api-route.ts";
import { at, tester } from "./rule-tester.ts";

tester.run("boundaries/api-route", apiRouteRule, {
  valid: [
    at(
      "src/pages/api/marks/apply.ts",
      'import type { APIRoute } from "astro";\nimport { handleMarkChange } from "@/features/marks/server";\nexport const POST: APIRoute = ({ request, locals }) => handleMarkChange(request, locals.userId);',
    ),
    at(
      "src/pages/api/marks/read.ts",
      'import { handleMarksRead } from "@/features/marks/server";\nexport function POST() {\n  return handleMarksRead;\n}\nexport type Answer = string;',
    ),
    at(
      "src/features/marks/server.ts",
      'import "server-only";\nexport function handleMarkChange() {}',
    ),
    at(
      "src/features/marks/marks-api.test.ts",
      'import { handleMarkChange } from "@/features/marks/server";',
    ),
    at("src/middleware.ts", 'import { authenticateRequest } from "@/features/auth/server";'),
    at(
      "src/features/stats/stats-model.ts",
      'import { loadUserMarks } from "@/features/marks/server";',
    ),
    at("src/features/marks/early-taps.ts", 'import { handleTap } from "@/features/marks/taps";'),
    at(
      "src/features/stats/stats-model.ts",
      'import type * as marks from "@/features/marks/server";',
    ),
    at("src/env.d.ts", "declare namespace App {}"),
    at("scripts/migrate.ts", 'import { handleMarkChange } from "@/features/marks/server";'),
  ],
  invalid: [
    {
      name: "an endpoint beside the pages",
      ...at("src/pages/marks.ts", "export const POST = () => new Response();"),
      errors: [{ messageId: "misplaced" }],
    },
    {
      name: "an endpoint in the fragments folder",
      ...at("src/pages/fragments/reset.ts", "export const POST = () => new Response();"),
      errors: [{ messageId: "misplaced" }],
    },
    {
      name: "a data change behind GET",
      ...at(
        "src/pages/api/marks/reset.ts",
        'import { handleMarkChange } from "@/features/marks/server";\nexport const GET = handleMarkChange;',
      ),
      errors: [{ messageId: "notPost" }],
    },
    {
      name: "a second method beside POST, a catch-all and a default export",
      ...at(
        "src/pages/api/marks/apply.ts",
        "export const POST = () => new Response();\nexport function DELETE() {}\nconst ALL = POST;\nexport { ALL };\nexport default POST;",
      ),
      errors: [{ messageId: "notPost" }, { messageId: "notPost" }, { messageId: "notPost" }],
    },
    {
      name: "POST renamed on the way out, and a star re-export",
      ...at(
        "src/pages/api/marks/apply.ts",
        'const POST = () => new Response();\nexport { POST as PUT };\nexport * from "@/features/marks/server";',
      ),
      errors: [{ messageId: "notPost" }, { messageId: "notPost" }],
    },
    {
      name: "an API route that writes to the database itself",
      ...at(
        "src/pages/api/marks/apply.ts",
        'import { turso } from "@/shared/server/database";\nexport const POST = () => turso;',
      ),
      errors: [{ messageId: "foreignImport" }],
    },
    {
      name: "an API route that reaches past the server entry, statically and lazily",
      ...at(
        "src/pages/api/marks/apply.ts",
        'import { answerMarkChange } from "@/features/marks/marks-api";\nexport const POST = async () => (await import("@/features/marks")).marksStore;',
      ),
      errors: [{ messageId: "foreignImport" }, { messageId: "foreignImport" }],
    },
    {
      name: "a module outside the API routes that answers a mark change",
      ...at(
        "src/features/stats/stats-model.ts",
        'import { loadUserMarks, handleMarkChange } from "@/features/marks/server";',
      ),
      errors: [{ messageId: "handlerOutsideApi" }],
    },
    {
      name: "the middleware answering a marks read under another name",
      ...at(
        "src/middleware.ts",
        'import { handleMarksRead as readMarks } from "@/features/marks/server";',
      ),
      errors: [{ messageId: "handlerOutsideApi" }],
    },
    {
      name: "a handler re-exported from another feature's entry",
      ...at(
        "src/features/stats/server.ts",
        'export { handleMarkChange } from "@/features/marks/server";',
      ),
      errors: [{ messageId: "handlerOutsideApi" }],
    },
    {
      name: "a namespace import and a star re-export of a server entry",
      ...at(
        "src/features/stats/server.ts",
        'import * as marks from "@/features/marks/server";\nexport * from "@/features/marks/server";',
      ),
      errors: [{ messageId: "namespaceOutsideApi" }, { messageId: "namespaceOutsideApi" }],
    },
  ],
});

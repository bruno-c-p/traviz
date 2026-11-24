import { Database } from "bun:sqlite";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROUTES, notFoundPath } from "@/paths";
import type { Route, RouteAccess } from "@/paths";
import { createMarksTableSql } from "@/shared/server/marks-table";
import {
  findFreePort,
  startServer,
  stopServer,
  waitForServer,
  type Environment,
} from "@/shared/testing/perf/builds";

export type PageRoute = { readonly path: Route; readonly access: RouteAccess };

const BUNDLE_USER_ID = "user_bundle_check";

const PLACEHOLDER_CLERK_KEYS = {
  PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_Y2xlcmsuZXhhbXBsZS5jb20k",
  CLERK_SECRET_KEY: "sk_live_bundle_check",
};

export function pageRoutes(): PageRoute[] {
  return ROUTES.filter((route) => !route.path.startsWith("/api/"));
}

function expectedStatus(path: Route): number {
  return path === notFoundPath() ? 404 : 200;
}

async function fetchPage(origin: string, path: Route): Promise<string> {
  const response = await fetch(`${origin}${path}`, {
    redirect: "manual",
    headers: { accept: "text/html", "sec-fetch-dest": "document" },
  });

  if (response.status !== expectedStatus(path))
    throw new Error(
      `${path} answered ${response.status}${response.headers.has("location") ? ` to ${response.headers.get("location")}` : ""}, not ${expectedStatus(path)}, so its HTML cannot be measured.`,
    );

  return response.text();
}

export async function renderRoutes(
  buildRoot: string,
  routes: readonly PageRoute[],
): Promise<Map<Route, string>> {
  if (!existsSync(join(buildRoot, "dist", "server", "entry.mjs")))
    throw new Error(
      `${join(buildRoot, "dist", "server", "entry.mjs")} not found. Run bun run build:node first.`,
    );

  const workDirectory = mkdtempSync(join(tmpdir(), "traviz-bundle-"));
  const databasePath = join(workDirectory, "bundle.db");
  const database = new Database(databasePath);

  database.run(createMarksTableSql);
  database.close();

  const inherited: Environment = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) =>
        !name.startsWith("TRAVIZ_") && !name.includes("CLERK") && !name.startsWith("TURSO_"),
    ),
  );

  const shared: Environment = {
    ...inherited,
    NODE_ENV: "production",
    TURSO_DATABASE_URL: `file:${databasePath}`,
  };

  const sessions = [
    {
      name: "signed-in",
      environment: { ...shared, TRAVIZ_FIXED_USER_ID: BUNDLE_USER_ID },
      routes: routes.filter((route) => route.access === "signedIn"),
    },
    {
      name: "signed-out",
      environment: { ...shared, ...PLACEHOLDER_CLERK_KEYS },
      routes: routes.filter((route) => route.access !== "signedIn"),
    },
  ];

  const pages = new Map<Route, string>();

  for (const session of sessions) {
    const port = await findFreePort();
    const logPath = join(workDirectory, `${session.name}.log`);
    const server = startServer(buildRoot, port, session.environment, logPath);

    try {
      await waitForServer(server, port, logPath);

      for (const route of session.routes)
        pages.set(route.path, await fetchPage(`http://127.0.0.1:${port}`, route.path));
    } catch (cause: unknown) {
      throw new Error(
        `Rendering the ${session.name} pages failed: ${cause instanceof Error ? cause.message : String(cause)} Server log: ${logPath}`,
        { cause },
      );
    } finally {
      stopServer(server);
    }
  }

  rmSync(workDirectory, { recursive: true, force: true });

  return pages;
}

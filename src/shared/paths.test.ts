import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { join } from "node:path";
import { ROUTES, welcomePath } from "@/paths";

const appDirectory = join(import.meta.dir, "..", "app");

const routeFiles = (): string[] =>
  [...new Glob("**/{page,route}.{ts,tsx,js,jsx}").scanSync(appDirectory)].filter(
    (file) => !file.split("/").some((segment) => segment.startsWith("_")),
  );

const landingDirectory = join(import.meta.dir, "..", "..", "landing", "pages");

const landingPagePaths = (): string[] =>
  [...new Glob("**/*.astro").scanSync(landingDirectory)].map((file) => {
    const segments = file
      .replace(/\.astro$/, "")
      .split("/")
      .filter((segment) => segment !== "index");

    return [welcomePath(), ...segments].join("/");
  });

const routePathOf = (file: string): string => {
  const segments = file
    .split("/")
    .slice(0, -1)
    .filter((segment) => !segment.startsWith("("));

  return `/${segments.join("/")}`;
};

describe("ROUTES", () => {
  test("has no dynamic, catch-all or parallel route that exact matching cannot gate", () => {
    expect(routeFiles().filter((file) => /\[|@|\(\./.test(file))).toEqual([]);
  });

  test("has exactly one row for every page and route handler under src/app and every landing page", () => {
    expect(ROUTES.map((route): string => route.path).sort()).toEqual(
      [...routeFiles().map(routePathOf), ...landingPagePaths()].sort(),
    );
  });

  test("serves the landing page that Astro builds at the welcome path", () => {
    expect(landingPagePaths()).toEqual([welcomePath()]);
  });
});

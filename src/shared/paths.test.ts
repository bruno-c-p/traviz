import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { ROUTES, homePath, notFoundPath, welcomePath } from "@/paths";

const sourceDirectory = join(import.meta.dir, "..");
const pagesDirectory = join(sourceDirectory, "pages");

const sourceFiles = (): string[] =>
  [...new Glob("**/*.{ts,astro}").scanSync(sourceDirectory)].filter(
    (file) => !file.endsWith(".test.ts") && !file.startsWith("shared/testing/"),
  );

const escaped = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");

const inlineRoutePattern = new RegExp(
  `["'\`](?:${ROUTES.flatMap((route) => (route.path === homePath() ? [] : [escaped(route.path)])).join("|")})["'\`?#]`,
);

const pageFiles = (): string[] =>
  [...new Glob("**/*.{astro,ts,js,md,mdx,html}").scanSync(pagesDirectory)].filter(
    (file) => !file.split("/").some((segment) => segment.startsWith("_")),
  );

const routePathOf = (file: string): string => {
  const segments = file
    .replace(/\.[^.]+$/, "")
    .split("/")
    .filter((segment) => segment !== "index");

  return `/${segments.join("/")}`;
};

describe("ROUTES", () => {
  test("has no dynamic or rest route that exact matching cannot gate", () => {
    expect(pageFiles().filter((file) => file.includes("["))).toEqual([]);
  });

  test("has exactly one row for every page and endpoint under src/pages", () => {
    expect(ROUTES.map((route): string => route.path).sort()).toEqual(
      pageFiles().map(routePathOf).sort(),
    );
  });

  test("serves the landing page at the welcome path and the not-found page at /404", () => {
    expect(pageFiles().map(routePathOf)).toContain(welcomePath());
    expect(pageFiles().map(routePathOf)).toContain(notFoundPath());
  });

  test("is the only place that spells a route's path, so no module writes one inline", () => {
    expect(inlineRoutePattern.test('href="/list"')).toBe(true);
    expect(inlineRoutePattern.test("fetch(`/api/marks/apply?x=1`)")).toBe(true);
    expect(inlineRoutePattern.test('"/listing"')).toBe(false);
    expect(
      sourceFiles().filter((file) =>
        inlineRoutePattern.test(readFileSync(join(sourceDirectory, file), "utf8")),
      ),
    ).toEqual([]);
  });
});

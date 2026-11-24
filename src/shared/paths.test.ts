import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { join } from "node:path";
import { ROUTES, notFoundPath, welcomePath } from "@/paths";

const pagesDirectory = join(import.meta.dir, "..", "pages");

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
});

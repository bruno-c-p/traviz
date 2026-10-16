import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { join } from "node:path";
import { ROUTES } from "@/paths";

const appDirectory = join(import.meta.dir, "..", "app");

const routeFiles = (): string[] =>
  [...new Glob("**/{page,route}.{ts,tsx,js,jsx}").scanSync(appDirectory)].filter(
    (file) => !file.split("/").some((segment) => segment.startsWith("_")),
  );

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

  test("has exactly one row for every page and route handler under src/app", () => {
    expect(ROUTES.map((route): string => route.path).sort()).toEqual(
      routeFiles().map(routePathOf).sort(),
    );
  });
});

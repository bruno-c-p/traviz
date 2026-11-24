import { expect, test } from "bun:test";
import {
  NAVIGATION_ITEMS,
  laterViews,
  navLinkClass,
  navigationItem,
  parseNavPlacement,
  parseViewName,
  viewForPath,
  viewsToPrefetch,
} from "@/features/app-shell/navigation";
import { ROUTES, homePath, listPath, statsPath, welcomePath } from "@/paths";

test("each tab's page and fragment are signed-in routes", () => {
  for (const item of NAVIGATION_ITEMS) {
    expect(ROUTES.find((route) => route.path === item.href)?.access).toBe("signedIn");
    expect(ROUTES.find((route) => route.path === item.fragment)?.access).toBe("signedIn");
  }
});

test("a path maps to its view, and any other path to none", () => {
  expect(viewForPath(homePath())).toBe("globe");
  expect(viewForPath(listPath())).toBe("list");
  expect(viewForPath(statsPath())).toBe("stats");
  expect(viewForPath(welcomePath())).toBeNull();
  expect(viewForPath("/list/")).toBeNull();
});

test("attribute values parse to a view or a placement", () => {
  expect(parseViewName("stats")).toBe("stats");
  expect(parseViewName("settings")).toBeNull();
  expect(parseViewName(undefined)).toBeNull();
  expect(parseNavPlacement("tab")).toBe("tab");
  expect(parseNavPlacement(null)).toBe("top");
});

test("the selected link gets the active colours and the others the idle ones", () => {
  expect(navLinkClass("tab", true)).toContain("bg-active text-on-active");
  expect(navLinkClass("tab", true)).not.toContain("text-body");
  expect(navLinkClass("top", false)).toContain("text-body hover:bg-canvas-soft hover:text-ink");
  expect(navLinkClass("top", false)).toContain("min-h-10");
  expect(navLinkClass("tab", false)).toContain("min-h-14");
});

test("the views missing from the document are prefetched in tab order", () => {
  expect(viewsToPrefetch(["list"])).toEqual(["globe", "stats"]);
  expect(viewsToPrefetch(["stats", "globe", "list"])).toEqual([]);
});

test("a view is inserted before the views that come after it in tab order", () => {
  expect(laterViews("globe")).toEqual(["list", "stats"]);
  expect(laterViews("list")).toEqual(["stats"]);
  expect(laterViews("stats")).toEqual([]);
  expect(navigationItem("list").fragment).toBe("/fragments/list");
});

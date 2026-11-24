import { expect, test } from "bun:test";
import { markStatusText } from "@/features/marks/mark-status";

test("a country with a pending save reads as saving, even with an older problem", () => {
  expect(markStatusText("DEU", ["DEU"], [{ scope: "DEU", reason: "unavailable" }])).toEqual({
    kind: "saving",
    text: "Saving…",
  });
  expect(markStatusText("DEU", "all", [])).toEqual({ kind: "saving", text: "Saving…" });
});

test.each([
  ["unavailable", "Couldn't save"],
  ["rejected", "Couldn't save"],
  ["signed-out", "Sign in to save"],
  ["other-account", "Account changed"],
] as const)("a %s problem on the country reads %p", (reason, text) => {
  expect(markStatusText("DEU", ["FRA"], [{ scope: "DEU", reason }])).toEqual({
    kind: "problem",
    text,
  });
});

test("a country with no save and no problem has no status", () => {
  expect(markStatusText("DEU", ["FRA"], [{ scope: "FRA", reason: "unavailable" }])).toBeNull();
});

test("the snapshot scope never reads as saving and has its own text", () => {
  expect(markStatusText("snapshot", "all", [])).toBeNull();
  expect(markStatusText("snapshot", [], [{ scope: "snapshot", reason: "unavailable" }])).toEqual({
    kind: "problem",
    text: "Couldn't load your latest marks.",
  });
});

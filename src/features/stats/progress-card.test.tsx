import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ProgressCard } from "@/features/stats/progress-card";

describe("ProgressCard", () => {
  test.each([
    ["hero", "of 195 · 0.0%"],
    ["panel", "of 195 · 0.0%"],
    ["peek", "/ 195 visited"],
  ] as const)("the %s card counts visits against the 195 sovereign entries", (variant, text) => {
    expect(renderToStaticMarkup(<ProgressCard variant={variant} />)).toContain(text);
  });
});

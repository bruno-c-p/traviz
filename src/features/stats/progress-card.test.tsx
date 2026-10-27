import { describe, expect, test } from "bun:test";
import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import { MarksBoundary, MarksSeedProvider } from "@/features/marks";
import type { Marks } from "@/features/marks";
import { ProgressCard } from "@/features/stats/progress-card";

describe("ProgressCard", () => {
  test.each([
    ["hero", "of 195 · 0.0%"],
    ["panel", "of 195 · 0.0%"],
    ["peek", "/ 195 visited"],
  ] as const)("the %s card counts visits against the 195 sovereign entries", (variant, text) => {
    expect(renderToStaticMarkup(<ProgressCard variant={variant} />)).toContain(text);
  });

  test("the peek link names no count while the seed is pending, then names the seed's count", async () => {
    const seed = Promise.withResolvers<{ ok: true; ownerId: string; marks: Marks }>();

    const stream = await renderToReadableStream(
      <main>
        <MarksSeedProvider seed={seed.promise}>
          <MarksBoundary>
            <ProgressCard variant="peek" />
          </MarksBoundary>
        </MarksSeedProvider>
      </main>,
    );

    const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
    let shell = "";

    while (!shell.includes("</main>")) shell += (await reader.read()).value ?? "";

    seed.resolve({ ok: true, ownerId: "user_a", marks: { JPN: "visited", FRA: "visited" } });

    let streamed = "";

    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      streamed += chunk.value;
    }

    expect(shell).toContain('aria-label="See all stats"');
    expect(shell).not.toContain("countries visited. See all stats");
    expect(streamed).toContain('aria-label="2 of 195 countries visited. See all stats"');
  });
});

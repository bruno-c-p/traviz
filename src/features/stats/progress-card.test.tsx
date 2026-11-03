import { describe, expect, test } from "bun:test";
import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import { MarksBoundary, MarksSeedProvider } from "@/features/marks";
import type { Marks } from "@/features/marks";
import { SOVEREIGN_COUNTRIES, countries } from "@/features/countries";
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

  test.each([
    ["panel", false],
    ["hero", true],
  ] as const)(
    "the %s card counts only sovereign entries when a territory is not interested",
    async (variant, showsCaption) => {
      const territory = countries.find((country) => country.kind === "territory");

      const marks: Marks = {
        ...Object.fromEntries(
          SOVEREIGN_COUNTRIES.slice(0, 17).map((country) => [country.code, "not_interested"]),
        ),
        [SOVEREIGN_COUNTRIES[17]?.code ?? ""]: "visited",
        [SOVEREIGN_COUNTRIES[18]?.code ?? ""]: "want",
        [territory?.code ?? ""]: "not_interested",
      };

      const stream = await renderToReadableStream(
        <MarksSeedProvider seed={Promise.resolve({ ok: true, ownerId: "user_a", marks })}>
          <MarksBoundary>
            <ProgressCard variant={variant} />
          </MarksBoundary>
        </MarksSeedProvider>,
      );

      await stream.allReady;
      const text = (await new Response(stream).text()).replaceAll(/<[^>]+>/g, " ");

      expect(text).toContain("of 178 · 0.6%");
      expect(text.includes("17 not interested left out")).toBe(showsCaption);

      if (variant === "panel") {
        expect(text).toMatch(/ 1 \s+want to go/);
        expect(text).toMatch(/ 17 \s+not interested/);
        expect(text).not.toContain("18");
      }
    },
  );
});

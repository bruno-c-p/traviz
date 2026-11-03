import { describe, expect, test } from "bun:test";
import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import { MarksBoundary, MarksSeedProvider } from "@/features/marks";
import type { Marks } from "@/features/marks";
import { countries } from "@/features/countries";
import { ProgressCard } from "@/features/stats/progress-card";

describe("ProgressCard", () => {
  test.each([
    ["hero", "of 250 · 0.0%"],
    ["panel", "of 250 · 0.0%"],
    ["peek", "/ 250 visited"],
  ] as const)("the %s card counts visits against all 250 places", (variant, text) => {
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
    expect(shell).not.toContain("places visited. See all stats");
    expect(streamed).toContain('aria-label="2 of 250 places visited. See all stats"');
  });

  test.each([
    ["panel", false],
    ["hero", true],
  ] as const)(
    "the %s card leaves not interested territories out of the total like countries",
    async (variant, showsCaption) => {
      const territories = countries.filter((country) => country.kind === "territory");
      const sovereign = countries.filter((country) => country.kind === "sovereign");

      const marks: Marks = {
        ...Object.fromEntries(
          sovereign.slice(0, 17).map((country) => [country.code, "not_interested"]),
        ),
        [territories[0]?.code ?? ""]: "not_interested",
        [sovereign[17]?.code ?? ""]: "visited",
        [sovereign[18]?.code ?? ""]: "want",
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

      expect(text).toContain("of 232 · 0.4%");
      expect(text.includes("18 not interested left out")).toBe(showsCaption);

      if (variant === "panel") {
        expect(text).toMatch(/ 1 \s+want to go/);
        expect(text).toMatch(/ 18 \s+not interested/);
      }
    },
  );
});

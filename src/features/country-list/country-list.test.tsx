import { describe, expect, test } from "bun:test";
import { renderToReadableStream } from "react-dom/server";
import { CONTINENT_ORDER, countries } from "@/features/countries";
import { CountryList } from "@/features/country-list/country-list";
import { MarksBoundary, MarksSeedProvider } from "@/features/marks";
import type { Marks } from "@/features/marks";

function rowGroup(html: string, countryName: string): string {
  const start = html.indexOf(`aria-label="Mark ${countryName}"`);
  const end = html.indexOf('aria-label="Mark ', start + 1);

  return start === -1 ? "" : html.slice(start, end === -1 ? undefined : end);
}

describe("the /list server render", () => {
  test("the shell holds the list chrome and the rows' height, then the first rows stream with the seed's marks and the rest keep their height", async () => {
    const seed = Promise.withResolvers<{ ok: true; ownerId: string; marks: Marks }>();

    const stream = await renderToReadableStream(
      <main>
        <MarksSeedProvider seed={seed.promise}>
          <MarksBoundary>
            <CountryList />
          </MarksBoundary>
        </MarksSeedProvider>
      </main>,
    );

    const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
    let shell = "";

    while (!shell.includes("</main>")) shell += (await reader.read()).value ?? "";

    seed.resolve({
      ok: true,
      ownerId: "user_a",
      marks: { DZA: "visited", JPN: "visited", FRA: "visited", AGO: "want" },
    });

    let streamed = "";

    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      streamed += chunk.value;
    }

    streamed = streamed.replaceAll("<!-- -->", "");

    const continentCount = CONTINENT_ORDER.filter((continent) =>
      countries.some((country) => country.continent === continent),
    ).length;

    expect(shell).toContain("All countries");
    expect(shell).toContain('aria-label="Search countries"');
    expect(shell).toContain("data-marks-pending");
    expect(shell).not.toContain('aria-label="Mark ');
    expect(shell).toContain(`height:${countries.length * 60 + continentCount * 40}px`);

    const africanCount = countries.filter((country) => country.continent === "Africa").length;

    expect(streamed.match(/aria-label="Mark /g)?.length).toBe(20);
    expect(rowGroup(streamed, "Algeria")).toContain('aria-pressed="true" aria-label="Visited"');
    expect(rowGroup(streamed, "Angola")).toContain('aria-pressed="true" aria-label="Want to go"');
    expect(rowGroup(streamed, "Benin")).not.toContain('aria-pressed="true"');
    expect(rowGroup(streamed, "Japan")).toBe("");
    expect(streamed).toContain(`height:${(africanCount - 20) * 60}px`);
    expect(streamed).toMatch(/Visited<span[^>]*>3<\/span>/);
  });
});

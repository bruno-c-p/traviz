import { describe, expect, test } from "bun:test";
import { renderToReadableStream } from "react-dom/server";
import { MarksSeedProvider } from "@/features/marks/marks-seed-provider";
import type { MarksSnapshot } from "@/features/marks/marks-sync";
import { useMark, useMarks } from "@/features/marks/use-marks";

const OWNER = "user_a";

function ShownMarks() {
  const marks = useMarks();
  const japan = useMark("JPN");

  return (
    <p>
      marks[
      {Object.entries(marks)
        .map(([code, state]) => `${code}=${state}`)
        .join(",")}
      ] japan[{japan ?? "unmarked"}]
    </p>
  );
}

async function serverText(seed: Promise<MarksSnapshot | null> | null): Promise<string> {
  const tree = seed ? (
    <MarksSeedProvider seed={seed}>
      <ShownMarks />
    </MarksSeedProvider>
  ) : (
    <ShownMarks />
  );

  const stream = await renderToReadableStream(tree);
  await stream.allReady;
  const html = await new Response(stream).text();

  return html.replaceAll("<!-- -->", "");
}

describe("the marks a server render shows", () => {
  test("the seed's marks, before the store holds any", async () => {
    const seed = Promise.resolve<MarksSnapshot>({
      ok: true,
      ownerId: OWNER,
      marks: { JPN: "visited", PER: "want" },
    });

    const text = await serverText(seed);

    expect(text).toContain("marks[JPN=visited,PER=want]");
    expect(text).toContain("japan[visited]");
  });

  test.each([
    ["a failed read", Promise.resolve<MarksSnapshot>({ ok: false, ownerId: OWNER })],
    ["a signed-out request", Promise.resolve(null)],
    ["no seed", null],
  ] as const)("the store's empty marks after %s", async (_scenario, seed) => {
    const text = await serverText(seed);

    expect(text).toContain("marks[]");
    expect(text).toContain("japan[unmarked]");
  });
});

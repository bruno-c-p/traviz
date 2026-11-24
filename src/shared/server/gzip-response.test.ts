import { expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import { gzipResponse } from "@/shared/server/gzip-response";

const acceptsGzip = new Request("https://traviz.test/list", {
  headers: { "accept-encoding": "gzip, deflate, br" },
});

const html = (body: BodyInit) =>
  new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });

test("HTML is gzipped for a client that accepts gzip, and never as brotli", async () => {
  const response = gzipResponse(acceptsGzip, html("<p>Algeria</p>".repeat(200)));

  expect(response.headers.get("content-encoding")).toBe("gzip");
  expect(response.headers.get("vary")).toBe("Accept-Encoding");
  expect(gunzipSync(Buffer.from(await response.arrayBuffer())).toString()).toBe(
    "<p>Algeria</p>".repeat(200),
  );
});

test("a chunk reaches the client before the stream ends", async () => {
  const encoder = new TextEncoder();
  const release = Promise.withResolvers<undefined>();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode("<header>shell</header>"));
      await release.promise;
      controller.enqueue(encoder.encode("<main>marks</main>"));
      controller.close();
    },
  });

  const reader = gzipResponse(acceptsGzip, html(body)).body?.getReader();
  const first = await reader?.read();

  expect(first?.done).toBe(false);
  expect(first?.value?.byteLength).toBeGreaterThan(0);

  release.resolve(undefined);
});

test("a client that does not accept gzip gets the response as it is", () => {
  const response = html("<p>plain</p>");

  expect(gzipResponse(new Request("https://traviz.test/list"), response)).toBe(response);
});

test("fonts, encoded bodies and empty bodies pass through", () => {
  const font = new Response("font", { headers: { "content-type": "font/woff2" } });

  const encoded = new Response("x", {
    headers: { "content-type": "text/html", "content-encoding": "br" },
  });

  const redirect = new Response(null, { status: 307, headers: { location: "/sign-in" } });

  expect(gzipResponse(acceptsGzip, font)).toBe(font);
  expect(gzipResponse(acceptsGzip, encoded)).toBe(encoded);
  expect(gzipResponse(acceptsGzip, redirect)).toBe(redirect);
});

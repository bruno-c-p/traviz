import "server-only";
import { constants, createGzip } from "node:zlib";

const COMPRESSIBLE_TYPE =
  /^(?:text\/|application\/(?:javascript|json|manifest\+json)|image\/svg\+xml)/;

function isCompressible(request: Request, response: Response): boolean {
  return (
    response.body !== null &&
    /\bgzip\b/.test(request.headers.get("accept-encoding") ?? "") &&
    COMPRESSIBLE_TYPE.test(response.headers.get("content-type") ?? "") &&
    !response.headers.has("content-encoding")
  );
}

function gzipStream(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const gzip = createGzip({ level: 6 });
  const reader = source.getReader();
  let isClosed = false;
  let isFlushScheduled = false;

  const flush = () => {
    isFlushScheduled = false;

    if (!isClosed && !gzip.writableEnded) gzip.flush(constants.Z_SYNC_FLUSH);
  };

  const pump = async () => {
    for (let chunk = await reader.read(); !chunk.done && !isClosed; chunk = await reader.read()) {
      gzip.write(chunk.value);

      if (!isFlushScheduled) {
        isFlushScheduled = true;
        setImmediate(flush);
      }
    }
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      gzip.on("data", (chunk: Buffer) => {
        if (!isClosed) controller.enqueue(new Uint8Array(chunk));
      });
      gzip.on("end", () => {
        if (isClosed) return;

        isClosed = true;
        controller.close();
      });
      gzip.on("error", (cause: Error) => {
        if (isClosed) return;

        isClosed = true;
        controller.error(cause);
      });

      pump().then(
        () => {
          if (!isClosed) gzip.end();
        },
        (cause: unknown) => {
          gzip.destroy(cause instanceof Error ? cause : new Error(String(cause)));
        },
      );
    },
    cancel() {
      isClosed = true;
      gzip.destroy();

      return reader.cancel();
    },
  });
}

export function gzipResponse(request: Request, response: Response): Response {
  if (response.body === null || !isCompressible(request, response)) return response;

  const headers = new Headers(response.headers);

  headers.delete("content-length");
  headers.set("content-encoding", "gzip");
  headers.append("vary", "Accept-Encoding");

  return new Response(gzipStream(response.body), { status: response.status, headers });
}

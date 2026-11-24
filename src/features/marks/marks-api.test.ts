import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createClient, type Client } from "@libsql/client";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { answerMarkChange, answerMarksRead, isSameOrigin } from "@/features/marks/marks-api";
import { markRowSchema } from "@/features/marks/schemas";
import { createMarksTableSql } from "@/shared/server/marks-table";

const ORIGIN = "https://traviz.test";

const databaseDirectory = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  ".data",
  `marks-api-test-${process.pid}`,
);

let databaseCount = 0;
let client: Client;

beforeEach(async () => {
  databaseCount += 1;
  mkdirSync(databaseDirectory, { recursive: true });
  client = createClient({ url: `file:${join(databaseDirectory, `marks-${databaseCount}.db`)}` });
  await client.execute(createMarksTableSql);
});

afterEach(() => {
  client.close();
});

afterAll(() => {
  rmSync(databaseDirectory, { recursive: true, force: true });
});

function post(path: string, body: string, origin: string | null = ORIGIN): Request {
  const headers = new Headers({ host: "traviz.test" });

  if (origin !== null) headers.set("origin", origin);

  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    body: new URLSearchParams(body),
    headers,
  });
}

function signedInAs(userId: string | null) {
  return {
    client,
    getUserId: () => Promise.resolve(userId),
    logWriteError: () => {},
    logReadError: () => {},
  };
}

async function storedMarks(userId: string) {
  const result = await client.execute({
    sql: "SELECT code, state FROM marks WHERE user_id = ? ORDER BY code",
    args: [userId],
  });

  return result.rows.map((row) => markRowSchema.parse(row));
}

async function answer(response: Promise<Response>): Promise<[number, string]> {
  const settled = await response;

  return [settled.status, await settled.text()];
}

describe("isSameOrigin", () => {
  test("only an origin whose host is the request's host passes", () => {
    expect(isSameOrigin(post("/api/marks/apply", ""))).toBe(true);
    expect(isSameOrigin(post("/api/marks/apply", "", "http://traviz.test"))).toBe(true);
    expect(isSameOrigin(post("/api/marks/apply", "", "https://evil.test"))).toBe(false);
    expect(isSameOrigin(post("/api/marks/apply", "", "https://traviz.test.evil.test"))).toBe(false);
    expect(isSameOrigin(post("/api/marks/apply", "", null))).toBe(false);
    expect(isSameOrigin(post("/api/marks/apply", "", "null"))).toBe(false);
  });

  test("the host comes from the Host header, not from the URL the server built", () => {
    const request = new Request("http://localhost/api/marks/apply", {
      method: "POST",
      headers: { host: "127.0.0.1:4321", origin: "http://127.0.0.1:4321" },
    });

    expect(isSameOrigin(request)).toBe(true);
  });

  test("a browser that says the request is cross-site is refused even with a matching origin", () => {
    const withFetchSite = (fetchSite: string) =>
      new Request(`${ORIGIN}/api/marks/apply`, {
        method: "POST",
        headers: { host: "traviz.test", origin: ORIGIN, "sec-fetch-site": fetchSite },
      });

    expect(isSameOrigin(withFetchSite("same-origin"))).toBe(true);
    expect(isSameOrigin(withFetchSite("cross-site"))).toBe(false);
    expect(isSameOrigin(withFetchSite("same-site"))).toBe(false);
  });
});

describe("the apply route", () => {
  const setZambia = "owner=user_a&kind=set&code=ZMB&state=want";

  test("a set, a clear and a reset each write the signed-in user's rows", async () => {
    const apply = (body: string) =>
      answer(answerMarkChange(post("/api/marks/apply", body), signedInAs("user_a")));

    expect(await apply(setZambia)).toEqual([200, "ok"]);
    expect(await apply("owner=user_a&kind=set&code=FRA&state=visited")).toEqual([200, "ok"]);
    expect(await storedMarks("user_a")).toEqual([
      { code: "FRA", state: "visited" },
      { code: "ZMB", state: "want" },
    ]);

    expect(await apply("owner=user_a&kind=clear&code=ZMB")).toEqual([200, "ok"]);
    expect(await storedMarks("user_a")).toEqual([{ code: "FRA", state: "visited" }]);

    expect(await apply("owner=user_a&kind=reset")).toEqual([200, "ok"]);
    expect(await storedMarks("user_a")).toEqual([]);
  });

  test("a request from another origin, or with none, is refused before anything is read", async () => {
    let sessionReads = 0;

    const dependencies = {
      ...signedInAs("user_a"),
      getUserId: () => {
        sessionReads += 1;

        return Promise.resolve("user_a");
      },
    };

    expect(
      await answer(
        answerMarkChange(post("/api/marks/apply", setZambia, "https://evil.test"), dependencies),
      ),
    ).toEqual([403, "rejected"]);
    expect(
      await answer(answerMarkChange(post("/api/marks/apply", setZambia, null), dependencies)),
    ).toEqual([403, "rejected"]);
    expect(sessionReads).toBe(0);
    expect(await storedMarks("user_a")).toEqual([]);
  });

  test("a signed-out request is answered signed-out and writes nothing", async () => {
    expect(
      await answer(answerMarkChange(post("/api/marks/apply", setZambia), signedInAs(null))),
    ).toEqual([401, "signed-out"]);
    expect(
      await answer(answerMarkChange(post("/api/marks/apply", "nonsense"), signedInAs(null))),
    ).toEqual([401, "signed-out"]);
    expect(await storedMarks("user_a")).toEqual([]);
  });

  test("a change made for another account is refused and writes for neither", async () => {
    expect(
      await answer(answerMarkChange(post("/api/marks/apply", setZambia), signedInAs("user_b"))),
    ).toEqual([409, "other-account"]);
    expect(await storedMarks("user_a")).toEqual([]);
    expect(await storedMarks("user_b")).toEqual([]);
  });

  test.each([
    "nonsense",
    "owner=user_a&kind=set&code=ZMB&state=loved",
    "owner=user_a&kind=set&code=XXX&state=want",
    "owner=user_a&kind=clear&code=",
  ])("the malformed change %p is rejected", async (body) => {
    expect(
      await answer(answerMarkChange(post("/api/marks/apply", body), signedInAs("user_a"))),
    ).toEqual([400, "rejected"]);
    expect(await storedMarks("user_a")).toEqual([]);
  });

  test("a database failure is answered unavailable", async () => {
    await client.execute("DROP TABLE marks");

    expect(
      await answer(answerMarkChange(post("/api/marks/apply", setZambia), signedInAs("user_a"))),
    ).toEqual([503, "unavailable"]);
  });
});

describe("the read route", () => {
  test("the signed-in owner reads a snapshot of their own marks", async () => {
    await answerMarkChange(
      post("/api/marks/apply", "owner=user_a&kind=set&code=ZMB&state=want"),
      signedInAs("user_a"),
    );

    expect(
      await answer(answerMarksRead(post("/api/marks/read", "owner=user_a"), signedInAs("user_a"))),
    ).toEqual([200, "owner=user_a&status=ok&ZMB=want"]);
  });

  test("another account, a signed-out user and another origin get no marks", async () => {
    await answerMarkChange(
      post("/api/marks/apply", "owner=user_a&kind=set&code=ZMB&state=want"),
      signedInAs("user_a"),
    );

    const read = (userId: string | null, origin: string | null = ORIGIN) =>
      answer(answerMarksRead(post("/api/marks/read", "owner=user_a", origin), signedInAs(userId)));

    expect(await read("user_b")).toEqual([503, "owner=user_a&status=failed"]);
    expect(await read(null)).toEqual([503, "owner=user_a&status=failed"]);
    expect(await read("user_a", "https://evil.test")).toEqual([403, ""]);
    expect(await read("user_a", null)).toEqual([403, ""]);
  });

  test("a read with no owner is refused", async () => {
    expect(
      await answer(answerMarksRead(post("/api/marks/read", ""), signedInAs("user_a"))),
    ).toEqual([400, ""]);
  });
});

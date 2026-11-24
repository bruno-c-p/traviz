import { describe, expect, test } from "bun:test";
import type { MarkChange, MarkChangeResult, MarksSnapshot } from "@/features/marks/marks-sync";
import {
  decodeMarkChangeRequest,
  decodeMarkChangeResult,
  decodeMarksSnapshot,
  decodeOwner,
  encodeMarkChangeRequest,
  encodeMarkChangeResult,
  encodeMarksSnapshot,
  encodeOwner,
} from "@/features/marks/marks-wire";

describe("a mark change request", () => {
  const changes: MarkChange[] = [
    { kind: "set", code: "DEU", state: "not_interested" },
    { kind: "clear", code: "FRA" },
    { kind: "reset" },
  ];

  test.each(changes)("$kind survives the wire", (change) => {
    const request = { expectedOwnerId: "user_a&b=c", change };

    expect(decodeMarkChangeRequest(encodeMarkChangeRequest(request))).toEqual(request);
  });

  test.each([
    "",
    "kind=reset",
    "owner=&kind=reset",
    "owner=user_a",
    "owner=user_a&kind=set&code=DEU",
    "owner=user_a&kind=set&code=DEU&state=loved",
    "owner=user_a&kind=clear",
    "owner=user_a&kind=erase&code=DEU",
  ])("%p is refused", (text) => {
    expect(decodeMarkChangeRequest(text)).toBeNull();
  });
});

describe("a mark change result", () => {
  const results: MarkChangeResult[] = [
    { ok: true },
    { ok: false, reason: "signed-out" },
    { ok: false, reason: "other-account" },
    { ok: false, reason: "rejected" },
    { ok: false, reason: "unavailable" },
  ];

  test.each(results)("%p survives the wire", (result) => {
    expect(decodeMarkChangeResult(encodeMarkChangeResult(result))).toEqual(result);
  });

  test("any other reply reads as unavailable", () => {
    expect(decodeMarkChangeResult("<html>Bad gateway</html>")).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});

describe("a marks snapshot", () => {
  const snapshots: MarksSnapshot[] = [
    { ok: true, ownerId: "user_a", marks: {} },
    { ok: true, ownerId: "user_a", marks: { DEU: "visited", FRA: "want", ITA: "not_interested" } },
    { ok: false, ownerId: "user_a" },
  ];

  test.each(snapshots)("%p survives the wire", (snapshot) => {
    expect(decodeMarksSnapshot(encodeMarksSnapshot(snapshot))).toEqual(snapshot);
  });

  test("text with no owner is no snapshot", () => {
    expect(decodeMarksSnapshot("")).toBeNull();
    expect(decodeMarksSnapshot("status=ok&DEU=visited")).toBeNull();
  });

  test("a mark with an unknown state fails the snapshot instead of dropping the mark", () => {
    expect(decodeMarksSnapshot("owner=user_a&status=ok&DEU=loved")).toEqual({
      ok: false,
      ownerId: "user_a",
    });
  });

  test("the encoded text holds no character that ends a script element", () => {
    const text = encodeMarksSnapshot({ ok: true, ownerId: "</script><b>", marks: {} });

    expect(text).not.toContain("<");
    expect(decodeMarksSnapshot(text)).toEqual({ ok: true, ownerId: "</script><b>", marks: {} });
  });
});

test("an owner survives the wire, and an empty one is none", () => {
  expect(decodeOwner(encodeOwner("user_a"))).toBe("user_a");
  expect(decodeOwner("")).toBeNull();
  expect(decodeOwner("owner=")).toBeNull();
});

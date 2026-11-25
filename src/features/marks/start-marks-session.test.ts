import { expect, test } from "bun:test";
import { createMarksOwner } from "@/features/marks/marks-owner";
import { createMarksStore } from "@/features/marks/marks-store";
import { encodeMarksSnapshot } from "@/features/marks/marks-wire";
import { startMarksSession } from "@/features/marks/start-marks-session";

function idleStore() {
  const neverReplies = () => new Promise<never>(() => {});

  return createMarksStore(
    createMarksOwner({ applyMarkChange: neverReplies, readMarks: neverReplies }, () => {}),
  );
}

test("the embedded snapshot starts the session with the server's marks", () => {
  const store = idleStore();

  startMarksSession(
    store,
    encodeMarksSnapshot({ ok: true, ownerId: "user_a", marks: { ZMB: "want" } }),
  );

  expect(store.getState().ownerId).toBe("user_a");
  expect(store.getState().marks).toEqual({ ZMB: "want" });
  expect(store.getState().problems).toEqual([]);
});

test("a failed snapshot starts the session and leaves a snapshot problem", () => {
  const store = idleStore();

  startMarksSession(store, encodeMarksSnapshot({ ok: false, ownerId: "user_a" }));

  expect(store.getState().ownerId).toBe("user_a");
  expect(store.getState().problems).toEqual([{ scope: "snapshot", reason: "unavailable" }]);
});

test("a page with no snapshot starts no session", () => {
  const store = idleStore();

  startMarksSession(store, null);
  startMarksSession(store, "");

  expect(store.getState().ownerId).toBeNull();
});

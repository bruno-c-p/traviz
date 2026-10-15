import { expect, test } from "bun:test";

test("tests can import modules guarded by server-only", async () => {
  await expect(import("server-only")).resolves.toBeDefined();
});

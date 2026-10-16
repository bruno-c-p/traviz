import { expect, test } from "bun:test";

test("tests can import modules guarded by server-only", async () => {
  const serverOnlyModule = await import("server-only");

  expect(serverOnlyModule).toBeDefined();
});

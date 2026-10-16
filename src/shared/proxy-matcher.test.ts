import { describe, expect, test } from "bun:test";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { listPath, signInVerifyPath } from "@/paths";
import { config } from "@/proxy";

describe("proxy matcher", () => {
  test.each(["/_next/static/x.js", "/icon.svg", "/apple-icon.png", "/manifest.webmanifest"])(
    "skips the proxy for %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    },
  );

  test.each([listPath(), signInVerifyPath()])("runs the proxy for %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });
});

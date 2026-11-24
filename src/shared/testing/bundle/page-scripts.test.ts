import { expect, test } from "bun:test";
import { readPageScripts } from "@/shared/testing/bundle/page-scripts";

test("reads inline scripts, loaded scripts and script preloads", () => {
  const scripts = readPageScripts(
    [
      '<link rel="stylesheet" href="/_astro/app.css">',
      '<link rel="modulepreload" href="/_astro/a.js">',
      "<link rel='preload' as='script' href='/_astro/b.js'>",
      '<link rel="preload" as="font" href="/_astro/font.woff2">',
      "<script>first()</script>",
      '<script type="module" src="/_astro/c.js"></script>',
      "<script src=/_astro/d.js async></script>",
    ].join(""),
  );

  expect(scripts.inlineSources).toEqual(["first()"]);
  expect(scripts.loadedUrls.map((url) => url.pathname)).toEqual(["/_astro/c.js", "/_astro/d.js"]);
  expect(scripts.preloadedUrls.map((url) => url.pathname)).toEqual([
    "/_astro/a.js",
    "/_astro/b.js",
  ]);
  expect(scripts.hasModuleScript).toBe(true);
});

test("leaves out data blocks, nomodule fallbacks and other elements that start with script", () => {
  const scripts = readPageScripts(
    [
      '<script type="text/plain" id="marks-snapshot">owner=a</script>',
      '<script type="application/json">{"a":1}</script>',
      '<script type="importmap">{}</script>',
      '<script nomodule src="/_astro/legacy.js"></script>',
      "<scripted>nothing()</scripted>",
      '<SCRIPT TYPE="text/javascript">shout()</SCRIPT>',
    ].join(""),
  );

  expect(scripts.inlineSources).toEqual(["shout()"]);
  expect(scripts.loadedUrls).toEqual([]);
  expect(scripts.hasModuleScript).toBe(false);
});

test("keeps the origin of a script from another site", () => {
  const { loadedUrls, preloadedUrls } = readPageScripts(
    '<link rel="preload" as="script" href="https://cdn.example.com/x.js"><script src="//cdn.example.com/y.js"></script>',
  );

  expect(preloadedUrls.map((url) => url.origin)).toEqual(["https://cdn.example.com"]);
  expect(loadedUrls.map((url) => url.host)).toEqual(["cdn.example.com"]);
});

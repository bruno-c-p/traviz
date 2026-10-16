import { RuleTester } from "oxlint/plugins-dev";

import { noCommentsRule } from "./no-comments.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });
const comment = { messageId: "comment" };

const mapCanvasAt62ec585 = `
// The popover is anchored to a screen point; it doesn't make sense once
// the user has navigated away from the map route.
useEffect(() => {
  if (pathname !== homePath()) setPopover(null);
}, [pathname]);

function stopSpin() {
  // Defensively cancel any in-flight Mapbox-driven animation (e.g. the
  // momentum ease after a drag release) so nothing keeps the map
  // "moving" past this point.
  map.stop();
}
`;

tester.run("boundaries/no-comments", noCommentsRule, {
  valid: [
    "const url = 'https://example.com/path';",
    "const pattern = /\\/\\/ not a comment/;",
    "const label = <span>{'// not a comment'}</span>;",
  ],
  invalid: [
    {
      name: "62ec585: the comment blocks in MapCanvas",
      code: mapCanvasAt62ec585,
      errors: [comment, comment, comment, comment, comment],
    },
    { name: "a block comment", code: "/* Linting */\nconst strict = true;", errors: [comment] },
    {
      name: "a JSDoc comment",
      code: "/** Spins the globe. */\nexport function spin() {}",
      errors: [comment],
    },
    { name: "a JSX comment", code: "const card = <div>{/* hint */}</div>;", errors: [comment] },
    { name: "a hashbang", code: "#!/usr/bin/env bun\nconst run = true;", errors: [comment] },
    {
      name: "a triple-slash reference",
      code: '/// <reference types="bun" />\nconst run = true;',
      errors: [comment],
    },
    {
      name: "a ts-expect-error directive",
      code: "// @ts-expect-error\nconst zoom: number = '2';",
      errors: [comment],
    },
    { name: "a trailing comment", code: "const zoom = 2; // world view", errors: [comment] },
  ],
});

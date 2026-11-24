import { expect, test } from "bun:test";
import { scopeUtilities } from "@/features/auth/scope-utilities";

const SCOPE = "[data-scope]";

test("nests every utility under the scope and leaves the other layers alone", () => {
  const css =
    "@layer theme{:root{--color-ink:#000}}@layer utilities{.hidden{display:none}.flex{display:flex}}@property --tw-x{syntax:'*';inherits:false}";

  expect(scopeUtilities(css, SCOPE)).toBe(
    "@layer theme{:root{--color-ink:#000}}@layer utilities{[data-scope]{.hidden{display:none}.flex{display:flex}}}@property --tw-x{syntax:'*';inherits:false}",
  );
});

test("keeps nested blocks, such as a media query, inside the scope", () => {
  const css = "@layer utilities{.a{color:red}@media (min-width:48rem){.md\\:b{top:0}}}.after{}";

  expect(scopeUtilities(css, SCOPE)).toBe(
    "@layer utilities{[data-scope]{.a{color:red}@media (min-width:48rem){.md\\:b{top:0}}}}.after{}",
  );
});

test("a brace inside a string does not end the layer", () => {
  const css = `@layer utilities{.a::after{content:"}"}.b::after{content:'\\'}'}.c{top:0}}`;

  expect(scopeUtilities(css, SCOPE)).toBe(
    `@layer utilities{[data-scope]{.a::after{content:"}"}.b::after{content:'\\'}'}.c{top:0}}}`,
  );
});

test("accepts the spaced form a development build writes", () => {
  const css = "@layer utilities {\n  .a {\n    top: 0;\n  }\n}\n";

  expect(scopeUtilities(css, SCOPE)).toBe(
    "@layer utilities {[data-scope]{\n  .a {\n    top: 0;\n  }\n}}\n",
  );
});

test("scopes each utilities layer when there are several", () => {
  const css = "@layer utilities{.a{top:0}}@layer base{b{top:0}}@layer utilities{.c{top:0}}";

  expect(scopeUtilities(css, SCOPE)).toBe(
    "@layer utilities{[data-scope]{.a{top:0}}}@layer base{b{top:0}}@layer utilities{[data-scope]{.c{top:0}}}",
  );
});

test("refuses a stylesheet with no utilities layer, which would leak into the page", () => {
  expect(() => scopeUtilities(".a{top:0}", SCOPE)).toThrow("no utilities layer");
});

test("refuses a utilities layer that never closes", () => {
  expect(() => scopeUtilities("@layer utilities{.a{top:0}", SCOPE)).toThrow("no closing brace");
});

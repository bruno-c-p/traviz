import { expect, test } from "bun:test";
import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ICON_NAMES, iconClass } from "@/shared/icons/icons";

const iconsDirectory = import.meta.dir;
const stylesheet = readFileSync(join(iconsDirectory, "icons.css"), "utf8");

test("every icon name has its Radix SVG and a mask utility that points at it", () => {
  expect([...new Glob("*.svg").scanSync(iconsDirectory)].sort()).toEqual(
    ICON_NAMES.map((name) => `${name}.svg`).sort(),
  );

  for (const name of ICON_NAMES) {
    expect(stylesheet).toContain(`@utility icon-${name} {\n  --icon: url("./${name}.svg");`);
  }
});

test("every SVG is a 15 by 15 Radix icon drawn in the current colour", () => {
  for (const name of ICON_NAMES) {
    const svg = readFileSync(join(iconsDirectory, `${name}.svg`), "utf8");

    expect(svg).toContain('viewBox="0 0 15 15"');
    expect(svg).toContain('fill="currentColor"');
  }
});

test("an icon's class is the mask base, its own utility and its size", () => {
  expect(iconClass("cross-2", "size-3")).toBe("icon icon-cross-2 size-3");
});

test("the Radix licence ships beside the icons", () => {
  expect(readFileSync(join(iconsDirectory, "LICENSE"), "utf8")).toContain("WorkOS");
});

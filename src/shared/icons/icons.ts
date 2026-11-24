export const ICON_NAMES = [
  "globe",
  "list-bullet",
  "bar-chart",
  "person",
  "magnifying-glass",
  "cross-2",
  "check",
  "star",
  "circle-backslash",
  "plus",
  "minus",
  "cursor-arrow",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

const ICON_CLASSES: Record<IconName, string> = {
  globe: "icon-globe",
  "list-bullet": "icon-list-bullet",
  "bar-chart": "icon-bar-chart",
  person: "icon-person",
  "magnifying-glass": "icon-magnifying-glass",
  "cross-2": "icon-cross-2",
  check: "icon-check",
  star: "icon-star",
  "circle-backslash": "icon-circle-backslash",
  plus: "icon-plus",
  minus: "icon-minus",
  "cursor-arrow": "icon-cursor-arrow",
};

export function iconClass(name: IconName, sizeClass: string): string {
  return `icon ${ICON_CLASSES[name]} ${sizeClass}`;
}

export const INLINE_ICON_NAMES = [
  "envelope-closed",
  "exit",
  "desktop",
  "sun",
  "moon",
  "exclamation-triangle",
] as const;

export type InlineIconName = (typeof INLINE_ICON_NAMES)[number];

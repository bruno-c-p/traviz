const CHIP_CLASS =
  "flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium pressable focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2";

const FILTER_CLASS =
  "flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium pressable focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2";

const SIDEBAR_ITEM_CLASS =
  "flex flex-col gap-2 rounded-2xl px-3.5 py-3 text-left pressable focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink";

export function chipClass(isActive: boolean): string {
  return `${CHIP_CLASS} ${isActive ? "bg-ink-deep text-white" : "bg-canvas text-body hover:text-ink"}`;
}

export function filterClass(isActive: boolean): string {
  return `${FILTER_CLASS} ${isActive ? "bg-ink text-canvas" : "bg-canvas text-body hover:bg-land hover:text-ink"}`;
}

export function countClass(isActive: boolean): string {
  return `font-mono text-xs ${isActive ? "text-primary" : "text-mute"}`;
}

export function sidebarItemClass(isActive: boolean): string {
  return `${SIDEBAR_ITEM_CLASS} ${isActive ? "bg-canvas-soft" : "hover:bg-canvas-soft"}`;
}

export function sidebarLabelClass(isActive: boolean): string {
  return `text-[15px] text-ink ${isActive ? "font-semibold" : "font-medium"}`;
}

export const SAVING_STATUS_CLASS = "-my-1 text-xs text-mute";

export const PROBLEM_STATUS_CLASS =
  "-my-1 flex min-w-0 items-center gap-1 text-xs text-negative-text";

export const PROBLEM_TEXT_CLASS = "min-w-0 truncate";

export const DISMISS_BUTTON_CLASS =
  "pressable flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-canvas-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink";

export const DISMISS_ICON_CLASS = "icon icon-x size-3";

export const ROW_HEIGHT = 60;

export const SERVER_ROW_COUNT = 12;

export function barTransform(visited: number, total: number): string {
  return `translateX(${(total > 0 ? (visited / total) * 100 : 0) - 100}%)`;
}

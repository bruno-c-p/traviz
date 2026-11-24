import {
  globeFragmentPath,
  homePath,
  listFragmentPath,
  listPath,
  statsFragmentPath,
  statsPath,
} from "@/paths";
import type { Route } from "@/paths";
import type { IconName } from "@/shared/icons/icons";

export type ViewName = "globe" | "list" | "stats";

export type NavigationItem = {
  readonly view: ViewName;
  readonly href: Route;
  readonly fragment: Route;
  readonly label: string;
  readonly icon: IconName;
};

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    view: "globe",
    href: homePath(),
    fragment: globeFragmentPath(),
    label: "Globe",
    icon: "globe",
  },
  {
    view: "list",
    href: listPath(),
    fragment: listFragmentPath(),
    label: "List",
    icon: "list-bullet",
  },
  {
    view: "stats",
    href: statsPath(),
    fragment: statsFragmentPath(),
    label: "Stats",
    icon: "bar-chart",
  },
];

export const VIEW_ORDER: readonly ViewName[] = NAVIGATION_ITEMS.map((item) => item.view);

export type NavPlacement = "top" | "tab";

const LINK_CLASSES: Record<NavPlacement, string> = {
  top: "flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold pressable focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
  tab: "flex min-h-14 flex-col items-center justify-center gap-1 rounded-[18px] text-xs font-semibold pressable focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
};

const ACTIVE_LINK_CLASS = "bg-active text-on-active";
const IDLE_LINK_CLASS = "text-body hover:bg-canvas-soft hover:text-ink";

export function navLinkClass(placement: NavPlacement, isActive: boolean): string {
  return `${LINK_CLASSES[placement]} ${isActive ? ACTIVE_LINK_CLASS : IDLE_LINK_CLASS}`;
}

export function parseViewName(value: string | null | undefined): ViewName | null {
  return VIEW_ORDER.find((view) => view === value) ?? null;
}

export function parseNavPlacement(value: string | null | undefined): NavPlacement {
  return value === "tab" ? "tab" : "top";
}

export function viewForPath(pathname: string): ViewName | null {
  return NAVIGATION_ITEMS.find((item) => item.href === pathname)?.view ?? null;
}

export function navigationItem(view: ViewName): NavigationItem {
  return NAVIGATION_ITEMS.find((item) => item.view === view) ?? NAVIGATION_ITEMS[0];
}

export function viewsToPrefetch(present: readonly ViewName[]): ViewName[] {
  return VIEW_ORDER.filter((view) => !present.includes(view));
}

export function laterViews(view: ViewName): ViewName[] {
  return VIEW_ORDER.slice(VIEW_ORDER.indexOf(view) + 1);
}

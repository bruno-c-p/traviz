import { BarChart3, Globe, List } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { homePath, listPath, statsPath } from "@/paths";

export type NavigationItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { href: homePath(), label: "Globe", Icon: Globe },
  { href: listPath(), label: "List", Icon: List },
  { href: statsPath(), label: "Stats", Icon: BarChart3 },
];

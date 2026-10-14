"use client";

import { BarChart3, Database, Globe, List as ListIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import type { DockItemData } from "@/components/Dock";
import { Dock } from "@/components/Dock";
import { dataPath, homePath, listPath, statsPath } from "@/paths";

const NAV_ITEMS = [
  { to: homePath(), label: "Map", Icon: Globe },
  { to: listPath(), label: "List", Icon: ListIcon },
  { to: statsPath(), label: "Stats", Icon: BarChart3 },
  { to: dataPath(), label: "Data", Icon: Database },
] as const;

const ACTIVE_DOT_CLASS =
  "after:absolute after:-bottom-1.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-['']";

export function AppNav() {
  const pathname = usePathname();

  const dockItems: DockItemData[] = NAV_ITEMS.map(({ to, label, Icon }) => ({
    icon: <Icon size={20} strokeWidth={1.75} />,
    label,
    href: to,
    className: pathname === to ? ACTIVE_DOT_CLASS : undefined,
  }));

  return <Dock items={dockItems} />;
}

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

const ACTIVE_ITEM_CLASS = "bg-ink text-primary hover:bg-ink hover:text-primary";

export function AppNav() {
  const pathname = usePathname();

  const dockItems: DockItemData[] = NAV_ITEMS.map(({ to, label, Icon }) => ({
    icon: <Icon size={20} strokeWidth={1.75} />,
    label,
    href: to,
    className: pathname === to ? ACTIVE_ITEM_CLASS : undefined,
  }));

  return <Dock items={dockItems} />;
}

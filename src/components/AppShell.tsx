"use client";

import { BarChart3, Database, Globe, List as ListIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthSession } from "../lib/authClient";
import { useCountriesStore } from "../store/countries";
import type { DockItemData } from "./Dock";
import { AuthPanel } from "./AuthPanel";
import { Dock } from "./Dock";
import { MapCanvas } from "./MapCanvas";

const NAV_ITEMS = [
  { to: "/", label: "Map", Icon: Globe },
  { to: "/list", label: "List", Icon: ListIcon },
  { to: "/stats", label: "Stats", Icon: BarChart3 },
  { to: "/data", label: "Data", Icon: Database },
] as const;

const ACTIVE_DOT_CLASS =
  "after:absolute after:-bottom-1.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary after:content-['']";

function SignedInLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isMapRoute = pathname === "/";

  const dockItems: DockItemData[] = NAV_ITEMS.map(({ to, label, Icon }) => ({
    icon: <Icon size={20} strokeWidth={1.75} />,
    label,
    onClick: () => router.push(to),
    className: pathname === to ? ACTIVE_DOT_CLASS : undefined,
  }));

  return (
    <div className="fixed inset-0 overflow-hidden bg-canvas-soft">
      <div className="absolute inset-0">
        <MapCanvas />
      </div>

      <div
        data-panel-scroll
        className={[
          "absolute inset-y-0 left-0 z-10 w-full overflow-y-auto border-canvas-soft bg-canvas/95 shadow-xl backdrop-blur-md transition-transform duration-300 ease-out md:w-[420px] md:border-r",
          isMapRoute ? "-translate-x-full" : "translate-x-0",
        ].join(" ")}
      >
        <div className="flex min-h-full flex-col pb-28">{children}</div>
      </div>

      <Dock items={dockItems} />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useAuthSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    void useCountriesStore.getState().load();
    return () => {
      useCountriesStore.getState().clearLocal();
    };
  }, [userId]);

  if (isPending) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-canvas-soft">
        <p className="text-sm text-mute">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <AuthPanel />;
  }

  return <SignedInLayout>{children}</SignedInLayout>;
}

import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { BarChart3, Database, Globe, List as ListIcon } from "lucide-react";
import { useEffect } from "react";
import { authClient } from "../lib/authClient";
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
  "after:absolute after:-bottom-1.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-teal-600 after:content-['']";

function SignedInLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isMapRoute = pathname === "/";

  const dockItems: DockItemData[] = NAV_ITEMS.map(({ to, label, Icon }) => ({
    icon: <Icon size={20} strokeWidth={1.75} />,
    label,
    onClick: () => navigate({ to }),
    className: pathname === to ? ACTIVE_DOT_CLASS : undefined,
  }));

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-100">
      <div className="absolute inset-0">
        <MapCanvas />
      </div>

      <div
        data-panel-scroll
        className={[
          "absolute inset-y-0 left-0 z-10 w-full overflow-y-auto border-slate-200 bg-white/95 shadow-xl backdrop-blur-md transition-transform duration-300 ease-out md:w-[420px] md:border-r",
          isMapRoute ? "-translate-x-full" : "translate-x-0",
        ].join(" ")}
      >
        <div className="flex min-h-full flex-col pb-28">
          <Outlet />
        </div>
      </div>

      <Dock items={dockItems} />
    </div>
  );
}

export function AppLayout() {
  const { data: session, isPending } = authClient.useSession();
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
      <div className="fixed inset-0 flex items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <AuthPanel />;
  }

  return <SignedInLayout />;
}

"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { MapCanvas } from "@/components/MapCanvas";
import { homePath } from "@/paths";
import { cn } from "@/lib/utils";

const MapboxPreload = dynamic(() =>
  import("@/components/MapboxPreload").then((module) => module.MapboxPreload),
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapRoute = pathname === homePath();

  return (
    <div className="fixed inset-0 overflow-hidden bg-canvas-soft">
      <div className="absolute inset-0">
        <MapCanvas />
        <MapboxPreload />
      </div>

      <div
        data-panel-scroll
        className={cn(
          "absolute inset-y-0 left-0 z-10 w-full overflow-y-auto border-line bg-canvas-soft/95 shadow-float backdrop-blur-md transition-transform duration-300 ease-out md:w-[440px] md:border-r",
          isMapRoute ? "-translate-x-full" : "translate-x-0",
        )}
      >
        <div className="flex min-h-full flex-col pb-28">{children}</div>
      </div>
    </div>
  );
}

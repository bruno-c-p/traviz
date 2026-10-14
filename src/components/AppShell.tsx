"use client";

import { usePathname } from "next/navigation";
import { MapCanvas } from "@/components/MapCanvas";
import { homePath } from "@/paths";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapRoute = pathname === homePath();

  return (
    <div className="fixed inset-0 overflow-hidden bg-canvas-soft">
      <div className="absolute inset-0">
        <MapCanvas />
      </div>

      <div
        data-panel-scroll
        className={cn(
          "absolute inset-0",
          isMapRoute
            ? "pointer-events-none"
            : "z-10 overflow-y-auto bg-canvas-soft pb-32 md:top-[76px] md:pb-12",
        )}
      >
        {children}
      </div>
    </div>
  );
}

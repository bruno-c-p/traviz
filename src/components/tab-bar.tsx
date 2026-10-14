"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVIGATION_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-4 z-40 grid grid-cols-3 gap-1 rounded-3xl bg-canvas p-1.5 shadow-float md:hidden"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      {NAVIGATION_ITEMS.map(({ href, label, Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 rounded-[18px] text-xs font-semibold pressable",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
              isActive ? "bg-ink text-primary" : "text-body hover:bg-canvas-soft hover:text-ink",
            )}
          >
            <Icon size={20} strokeWidth={2} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

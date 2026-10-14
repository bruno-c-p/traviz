"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVIGATION_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="pointer-events-auto flex gap-1 rounded-full bg-canvas p-1.5 shadow-card"
    >
      {NAVIGATION_ITEMS.map(({ href, label, Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
              isActive ? "bg-ink text-primary" : "text-body hover:bg-canvas-soft hover:text-ink",
            )}
          >
            <Icon size={16} strokeWidth={2} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountButton } from "@/components/account-button";
import { BrandMark } from "@/shared/brand-mark";
import { CountrySearch } from "@/components/country-search";
import { MainNav } from "@/components/main-nav";
import { cn } from "@/shared/cn";
import { homePath } from "@/paths";

export function TopBar() {
  const pathname = usePathname();
  const isMapRoute = pathname === homePath();

  return (
    <header
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-40 hidden grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-3.5 md:grid",
        !isMapRoute && "bg-canvas-soft",
      )}
    >
      <Link
        href={homePath()}
        aria-label="Traviz home"
        className="pointer-events-auto flex items-center gap-2.5 justify-self-start rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
      >
        <BrandMark size={40} className="text-primary" />
        <span className="hidden text-xl font-bold tracking-tight text-ink lg:inline">Traviz</span>
      </Link>
      <MainNav />
      <div className="pointer-events-auto flex items-center gap-2.5 justify-self-end">
        {isMapRoute && <CountrySearch className="w-48 lg:w-64" />}
        <AccountButton />
      </div>
    </header>
  );
}

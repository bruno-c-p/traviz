"use client";

import { ContinentChips } from "@/components/continent-chips";
import { ContinentSidebar } from "@/components/continent-sidebar";
import type { Continent } from "@/lib/stats";

type ContinentFilterProps = {
  selectedContinent: Continent | null;
  onSelect: (continent: Continent | null) => void;
  layout: "sidebar" | "chips";
  className?: string;
};

export function ContinentFilter({ layout, ...props }: ContinentFilterProps) {
  return layout === "chips" ? <ContinentChips {...props} /> : <ContinentSidebar {...props} />;
}

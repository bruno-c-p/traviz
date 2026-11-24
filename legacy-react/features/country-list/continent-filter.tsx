"use client";

import { ContinentChips } from "@/features/country-list/continent-chips";
import { ContinentSidebar } from "@/features/country-list/continent-sidebar";
import type { Continent } from "@/features/countries";

type ContinentFilterProps = {
  selectedContinent: Continent | null;
  onSelect: (continent: Continent | null) => void;
  layout: "sidebar" | "chips";
  className?: string;
};

export function ContinentFilter({ layout, ...props }: ContinentFilterProps) {
  return layout === "chips" ? <ContinentChips {...props} /> : <ContinentSidebar {...props} />;
}

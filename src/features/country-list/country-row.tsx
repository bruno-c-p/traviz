import { memo } from "react";
import { StateSwitch } from "@/features/marks";
import type { Country } from "@/features/countries";

export const CountryRow = memo(function CountryRow({ country }: { country: Country }) {
  return (
    <div className="flex h-full items-center gap-3 border-t border-canvas-soft bg-canvas px-4 sm:px-5">
      <span className="hidden w-10 shrink-0 font-mono text-xs text-mute sm:inline">
        {country.code}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
        {country.name}
      </span>
      {!country.counted && (
        <span
          title="Territory, not counted toward the 195 headline"
          className="hidden shrink-0 rounded-full bg-canvas-soft px-2 py-1 font-mono text-[10px] uppercase leading-none tracking-wide text-mute lg:inline"
        >
          Territory
        </span>
      )}
      <StateSwitch code={country.code} countryName={country.name} />
    </div>
  );
});

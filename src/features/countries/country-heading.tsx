import { X } from "lucide-react";
import type { Country } from "@/features/countries/countries";

type CountryHeadingProps = {
  country: Country;
  headingId: string;
  onClose: () => void;
};

export function CountryHeading({ country, headingId, onClose }: CountryHeadingProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-wider text-mute">
          {country.continent} · {country.code}
          {!country.counted && " · Territory"}
        </span>
        <h2 id={headingId} className="text-3xl font-bold tracking-tight text-ink">
          {country.name}
        </h2>
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-canvas-soft text-body pressable hover:bg-land hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}

import { useDeferredValue } from "react";
import { CountryRow } from "@/features/country-list/country-row";
import { limitSectionRows, type ListSection } from "@/features/country-list/country-list-items";
import { useHasMarksSeed } from "@/features/marks";
import { useIsClient } from "@/shared/use-is-client";

const ROW_HEIGHT = 60;
const HEADER_HEIGHT = 40;
const SERVER_ROW_LIMIT = 20;

function sectionsHeight(sections: readonly ListSection[]): number {
  return sections.reduce(
    (height, section) =>
      height + (section.continent ? HEADER_HEIGHT : 0) + section.countries.length * ROW_HEIGHT,
    0,
  );
}

type CountryRowsProps = {
  sections: readonly ListSection[];
  emptyMessage: string;
};

export function CountryRows({ sections, emptyMessage }: CountryRowsProps) {
  const hasMarksSeed = useHasMarksSeed();
  const showsEveryRow = useDeferredValue(useIsClient());

  if (sections.length === 0) {
    return (
      <div className="overflow-clip rounded-3xl bg-canvas shadow-card">
        <p className="px-6 py-12 text-center text-[15px] text-body">{emptyMessage}</p>
      </div>
    );
  }

  if (!hasMarksSeed) {
    return (
      <div
        className="rounded-3xl bg-canvas shadow-card"
        style={{ height: sectionsHeight(sections) }}
      />
    );
  }

  return (
    <div className="overflow-clip rounded-3xl bg-canvas shadow-card">
      {limitSectionRows(sections, showsEveryRow ? Infinity : SERVER_ROW_LIMIT).map(
        ({ continent, countries, hiddenCount }) => (
          <div key={continent ?? "results"}>
            {continent && (
              <div
                className="sticky top-0 z-10 flex items-center gap-2 bg-canvas-soft/95 px-5 font-mono text-xs uppercase tracking-wider text-mute"
                style={{ height: HEADER_HEIGHT }}
              >
                <span className="text-ink">{continent}</span>
                <span>{countries.length + hiddenCount}</span>
              </div>
            )}
            {countries.map((country) => (
              <div
                key={country.code}
                className="[content-visibility:auto]"
                style={{ height: ROW_HEIGHT, containIntrinsicSize: `auto ${ROW_HEIGHT}px` }}
              >
                <CountryRow country={country} />
              </div>
            ))}
            {hiddenCount > 0 && <div style={{ height: hiddenCount * ROW_HEIGHT }} />}
          </div>
        ),
      )}
    </div>
  );
}

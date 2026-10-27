import { CountryRow } from "@/features/country-list/country-row";
import type { ListSection } from "@/features/country-list/country-list-items";
import { useHasMarksSeed } from "@/features/marks";

const ROW_HEIGHT = 60;
const HEADER_HEIGHT = 40;

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
      {sections.map(({ continent, countries }) => (
        <div key={continent ?? "results"}>
          {continent && (
            <div
              className="sticky top-0 z-10 flex items-center gap-2 bg-canvas-soft/95 px-5 font-mono text-xs uppercase tracking-wider text-mute"
              style={{ height: HEADER_HEIGHT }}
            >
              <span className="text-ink">{continent}</span>
              <span>{countries.length}</span>
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
        </div>
      ))}
    </div>
  );
}

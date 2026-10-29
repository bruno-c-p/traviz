import { GlobeSpecimen } from "@/features/landing/globe-specimen";
import { ListSpecimen } from "@/features/landing/list-specimen";
import { StatsSpecimen } from "@/features/landing/stats-specimen";

const VIEWS = [
  {
    name: "Globe",
    text: "Spin it, zoom in and tap a country to mark it. Islands too small to tap get a dot of their own.",
    specimen: <GlobeSpecimen />,
  },
  {
    name: "List",
    text: "Every country by continent, with search and a filter for each state. Territories carry a label.",
    specimen: <ListSpecimen />,
  },
  {
    name: "Stats",
    text: "Your count toward 195, the totals for each state, and how far you’ve got on every continent.",
    specimen: <StatsSpecimen />,
  },
];

export function LandingViews() {
  return (
    <section aria-labelledby="views-title" className="pt-8 pb-8 lg:pt-12">
      <h2
        id="views-title"
        className="mb-12 max-w-[18ch] text-[clamp(2.25rem,1.2rem+3vw,4.5rem)] leading-[0.95] font-bold tracking-[-0.045em] text-balance"
      >
        One set of marks, three ways to read them
      </h2>
      <dl>
        {VIEWS.map(({ name, text, specimen }) => (
          <div
            key={name}
            className="grid gap-x-(--gutter) gap-y-4 border-t border-ink py-8 md:grid-cols-12 md:items-start"
          >
            <dt className="text-[clamp(1.75rem,1.2rem+1.6vw,2.75rem)] leading-none font-bold tracking-[-0.04em] md:col-span-4 lg:col-span-3">
              {name}
            </dt>
            <dd className="max-w-[34ch] text-[17px] leading-[1.5] text-body md:col-span-8 lg:col-span-4">
              {text}
            </dd>
            <dd className="md:col-span-8 md:col-start-5 lg:col-span-5 lg:col-start-8">
              {specimen}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

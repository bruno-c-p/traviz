import { MousePointerClick } from "lucide-react";

export function GlobeHint() {
  return (
    <section
      aria-label="How to mark countries"
      className="flex items-start gap-4 rounded-3xl bg-canvas p-5 shadow-card"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary">
        <MousePointerClick size={20} aria-hidden />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-lg font-bold tracking-tight text-ink">Pick a country</span>
        <span className="text-[15px] leading-relaxed text-body">
          Click any country on the globe, or search for one above, to mark it.
        </span>
      </span>
    </section>
  );
}

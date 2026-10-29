import { ActionLink } from "@/features/landing/action-link";
import { HeroGlobe } from "@/features/landing/hero-globe";
import { NameWall } from "@/features/landing/name-wall";
import { TallyAnnouncer } from "@/features/landing/tally-announcer";
import { StateChip } from "@/features/landing/state-chip";
import { TallySummary } from "@/features/landing/tally-summary";
import { signInPath } from "@/paths";

export function LandingHero() {
  return (
    <section
      aria-labelledby="landing-title"
      className="relative lg:grid lg:grid-cols-12 lg:gap-x-(--gutter)"
    >
      <div className="flex flex-col gap-6 pt-24 md:grid md:grid-cols-2 md:gap-x-(--gutter) lg:sticky lg:top-0 lg:col-span-4 lg:flex lg:h-svh lg:min-h-[46rem] lg:gap-5 lg:self-start lg:pt-22 lg:pb-6">
        <div className="flex flex-col items-start gap-5 md:self-center lg:self-auto">
          <h1
            id="landing-title"
            className="-ml-[0.04em] text-[clamp(2.75rem,1.2rem+3.3vw,4.25rem)] leading-[0.95] font-bold tracking-[-0.045em] text-balance text-ink"
          >
            Keep count of the world.
          </h1>
          <p className="max-w-[22rem] text-[17px] leading-[1.5] text-body lg:min-h-[4lh]">
            Mark the countries you’ve been to, the ones you want to see and the ones you’d skip.
            Traviz keeps them on a globe, in a list and in your totals.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <ActionLink href={signInPath()} label="Start your map" tone="primary" />
            <p className="text-[13px] text-mute">Email link sign-in. No password.</p>
          </div>
        </div>
        <div className="mx-auto aspect-square w-full max-w-[22rem] md:max-w-none lg:aspect-auto lg:min-h-0 lg:flex-1">
          <HeroGlobe />
        </div>
        <div className="hidden lg:block">
          <TallySummary size="large" />
        </div>
      </div>
      <div className="pt-10 pb-6 lg:col-span-8 lg:pt-24 lg:pb-28">
        <p id="wall-hint" className="mb-6 max-w-[56ch] text-[15px] leading-[1.75] text-body">
          All 195 countries, A to Z. Pick a name once for <StateChip state="visited" />, twice for{" "}
          <StateChip state="want" />, three times for <StateChip state="not_interested" />, and once
          more to clear it. Marks made here stay on this page.
        </p>
        <NameWall describedBy="wall-hint" />
        <TallyAnnouncer />
      </div>
      <div className="sticky bottom-0 z-10 -mx-(--gutter) border-t border-line bg-canvas-soft/95 px-(--gutter) py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden">
        <TallySummary size="compact" />
      </div>
    </section>
  );
}

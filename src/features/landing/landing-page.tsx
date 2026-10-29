import { LandingContinents } from "@/features/landing/landing-continents";
import { LandingFinale } from "@/features/landing/landing-finale";
import { LandingHeader } from "@/features/landing/landing-header";
import { LandingHero } from "@/features/landing/landing-hero";
import { LandingViews } from "@/features/landing/landing-views";

export function LandingPage() {
  return (
    <div className="relative [--gutter:clamp(1rem,0.4rem+2.2vw,2.5rem)]">
      <LandingHeader />
      <main className="px-(--gutter)">
        <LandingHero />
        <LandingContinents />
        <LandingViews />
        <LandingFinale />
      </main>
    </div>
  );
}

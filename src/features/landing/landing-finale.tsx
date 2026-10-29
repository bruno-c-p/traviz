import Link from "next/link";
import { PaintLabel } from "@/features/landing/paint-label";
import { signInPath } from "@/paths";

export function LandingFinale() {
  return (
    <section aria-labelledby="finale-title" className="flex flex-col gap-8 pt-28 pb-8 lg:pt-40">
      <h2 id="finale-title" className="sr-only">
        Start your map
      </h2>
      <Link
        href={signInPath()}
        className="group relative -ml-[0.05em] block w-fit overflow-hidden rounded-lg after:pointer-events-none after:absolute after:inset-x-[0.04em] after:bottom-[0.02em] after:h-[0.07em] after:rounded-full after:bg-primary text-[clamp(3.5rem,0.6rem+11.5vw,13rem)] leading-[0.92] font-bold tracking-[-0.055em] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-4 focus-visible:ring-offset-canvas-soft"
      >
        <PaintLabel
          label="Start your map."
          className="block px-[0.04em] pb-[0.26em]"
          coverClassName="bg-primary text-ink-deep"
        />
      </Link>
      <p className="max-w-[40ch] text-[17px] leading-[1.5] text-body">
        Enter your email and open the link we send. Your marks save as you make them and follow you
        to every device you sign in on.
      </p>
      <footer className="flex flex-col gap-2 border-t border-line pt-5 text-[13px] text-mute md:flex-row md:justify-between">
        <p>Traviz</p>
        <p>
          Country outlines from{" "}
          <a
            href="https://www.naturalearthdata.com/"
            className="inline-block py-1 underline underline-offset-2 hover:text-ink focus-visible:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            Natural Earth
          </a>
          . Country data from{" "}
          <a
            href="https://github.com/mledoze/countries"
            className="inline-block py-1 underline underline-offset-2 hover:text-ink focus-visible:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            world-countries
          </a>
          .
        </p>
      </footer>
    </section>
  );
}

import { PaintLabel } from "@/features/landing/paint-label";
import { homePath } from "@/paths";

export function NotOnTheMap() {
  return (
    <main className="flex min-h-svh flex-col justify-center gap-8 px-[clamp(1rem,0.4rem+2.2vw,2.5rem)] py-16">
      <h1 className="-ml-[0.05em] text-[clamp(3.25rem,0.8rem+10vw,11rem)] leading-[0.92] font-bold tracking-[-0.055em] text-ink">
        Not on the{" "}
        <span className="relative inline-block rounded-lg bg-skip px-[0.06em] motion-safe:animate-paint-in">
          map.
        </span>
      </h1>
      <p className="max-w-[40ch] text-[17px] leading-[1.5] text-body">
        There is no page at this address, and it isn’t one of the 195 countries either.
      </p>
      <a
        href={homePath()}
        className="pressable relative isolate inline-flex h-13 items-center justify-center self-start overflow-hidden rounded-full bg-primary px-7 text-[17px] font-semibold text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-soft"
      >
        <PaintLabel
          label="Back to Traviz"
          coverClassName="flex items-center justify-center bg-ink-deep text-primary"
        />
      </a>
    </main>
  );
}

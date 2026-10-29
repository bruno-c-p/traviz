import Link from "next/link";
import { ActionLink } from "@/features/landing/action-link";
import { BrandMark } from "@/shared/brand-mark";
import { signInPath, welcomePath } from "@/paths";

export function LandingHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-(--gutter) py-4">
      <a
        href="#countries"
        className="sr-only rounded-full bg-ink px-5 py-3.5 text-sm font-semibold text-canvas focus:not-sr-only focus:absolute focus:top-4 focus:left-1/2 focus:-translate-x-1/2"
      >
        Skip to the countries
      </a>
      <Link
        href={welcomePath()}
        className="group flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
      >
        <span aria-hidden="true">
          <BrandMark size={36} className="text-primary" />
        </span>
        <span className="bg-[linear-gradient(var(--color-primary),var(--color-primary))] bg-[length:0%_4px] bg-left-bottom bg-no-repeat pb-0.5 text-xl font-bold tracking-tight text-ink transition-[background-size] duration-300 ease-out group-hover:bg-[length:100%_4px] group-focus-visible:bg-[length:100%_4px] motion-reduce:transition-none">
          Traviz
        </span>
      </Link>
      <ActionLink href={signInPath()} label="Sign in" tone="quiet" />
    </header>
  );
}

import Link from "next/link";
import type { Route } from "next";
import { PaintLabel } from "@/features/landing/paint-label";
import { cn } from "@/shared/cn";

type ActionLinkProps = {
  href: Route;
  label: string;
  tone: "primary" | "quiet";
  className?: string;
};

const TONES = {
  primary: {
    link: "h-13 px-7 bg-primary text-[17px] font-semibold text-on-primary",
    cover: "flex items-center justify-center bg-ink-deep text-primary",
  },
  quiet: {
    link: "h-10 px-4.5 border border-line bg-canvas-soft text-[15px] font-semibold text-ink",
    cover: "flex items-center justify-center bg-ink text-canvas",
  },
};

export function ActionLink({ href, label, tone, className }: ActionLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "pressable relative isolate inline-flex items-center justify-center overflow-hidden rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-soft",
        TONES[tone].link,
        className,
      )}
    >
      <PaintLabel label={label} coverClassName={TONES[tone].cover} />
    </Link>
  );
}

import { cn } from "@/shared/cn";

type PaintLabelProps = { label: string; coverClassName: string; className?: string };

export function PaintLabel({ label, coverClassName, className }: PaintLabelProps) {
  return (
    <>
      <span className={className}>{label}</span>
      <span
        aria-hidden="true"
        className={cn(
          "paint-cover pointer-events-none absolute inset-0",
          coverClassName,
          className,
        )}
      >
        {label}
      </span>
    </>
  );
}

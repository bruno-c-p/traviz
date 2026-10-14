import { cn } from "@/lib/utils";

type TotalTileProps = {
  label: string;
  value: number;
  color: string;
  className?: string;
};

export function TotalTile({ label, value, color, className }: TotalTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-2 rounded-3xl bg-canvas p-4 shadow-card md:flex-row md:items-center md:px-5",
        className,
      )}
    >
      <span className="order-2 flex items-center gap-2 text-sm font-medium text-body md:order-1">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full ring-1 ring-ink/10"
          style={{ backgroundColor: color }}
        />
        {label}
      </span>
      <span className="order-1 text-3xl font-bold tabular-nums tracking-tight text-ink md:order-2">
        {value}
      </span>
    </div>
  );
}

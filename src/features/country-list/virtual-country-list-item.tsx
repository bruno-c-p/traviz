import { CountryRow } from "@/features/country-list/country-row";
import type { ListItem } from "@/features/country-list/country-list-items";

type VirtualCountryListItemProps = {
  item: ListItem;
  size: number;
  offset: number;
  isStuck: boolean;
};

export function VirtualCountryListItem({
  item,
  size,
  offset,
  isStuck,
}: VirtualCountryListItemProps) {
  return (
    <div
      style={{
        position: isStuck ? "sticky" : "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: size,
        zIndex: item.type === "header" ? 10 : undefined,
        transform: isStuck ? undefined : `translateY(${offset}px)`,
      }}
    >
      {item.type === "header" ? (
        <div className="flex h-full items-center gap-2 bg-canvas-soft/95 px-5 font-mono text-xs uppercase tracking-wider text-mute">
          <span className="text-ink">{item.continent}</span>
          <span>{item.count}</span>
        </div>
      ) : (
        <CountryRow country={item.country} />
      )}
    </div>
  );
}

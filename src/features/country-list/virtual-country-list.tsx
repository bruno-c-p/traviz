"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import type { Range } from "@tanstack/react-virtual";
import { VirtualCountryListItem } from "@/features/country-list/virtual-country-list-item";
import type { ListItem } from "@/features/country-list/country-list-items";

const ROW_HEIGHT = 60;
const HEADER_HEIGHT = 40;

type VirtualCountryListProps = {
  items: ListItem[];
  headerRef: RefObject<HTMLDivElement | null>;
  emptyMessage: string;
};

export function VirtualCountryList({ items, headerRef, emptyMessage }: VirtualCountryListProps) {
  const scrollRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const activeHeaderRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    const header = headerRef.current;

    if (!list || !header) return;

    scrollRef.current = list.closest<HTMLElement>("[data-panel-scroll]");

    const measure = () => setScrollMargin(list.offsetTop);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(header);

    return () => observer.disconnect();
  }, [headerRef]);

  const headerIndexes = useMemo(
    () => items.flatMap((item, index) => (item.type === "header" ? [index] : [])),
    [items],
  );

  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range);
      const activeHeader = headerIndexes.findLast((index) => index <= range.startIndex);
      activeHeaderRef.current = activeHeader ?? null;

      if (activeHeader === undefined || indexes.includes(activeHeader)) return indexes;

      return [activeHeader, ...indexes];
    },
    [headerIndexes],
  );

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (items[index].type === "header" ? HEADER_HEIGHT : ROW_HEIGHT),
    overscan: 8,
    scrollMargin,
    rangeExtractor,
  });

  return (
    <div ref={listRef} className="relative overflow-clip rounded-3xl bg-canvas shadow-card">
      {items.length === 0 ? (
        <p className="px-6 py-12 text-center text-[15px] text-body">{emptyMessage}</p>
      ) : (
        <div style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = items[virtualItem.index];

            return (
              <VirtualCountryListItem
                key={virtualItem.key}
                item={item}
                size={virtualItem.size}
                offset={virtualItem.start - scrollMargin}
                isStuck={item.type === "header" && activeHeaderRef.current === virtualItem.index}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

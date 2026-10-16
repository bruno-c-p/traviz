import { Search, X } from "lucide-react";

type ListSearchInputProps = {
  query: string;
  onQueryChange: (query: string) => void;
};

export function ListSearchInput({ query, onQueryChange }: ListSearchInputProps) {
  return (
    <div className="relative w-full sm:w-80">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-mute"
      />
      <input
        type="text"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search countries"
        aria-label="Search countries"
        autoComplete="off"
        className="h-12 w-full rounded-full border border-line bg-canvas pl-11 pr-12 text-[15px] text-ink placeholder:text-mute focus:border-ink focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {query && (
        <button
          type="button"
          onClick={() => onQueryChange("")}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-mute hover:bg-canvas-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <X size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}

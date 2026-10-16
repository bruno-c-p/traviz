import { useId, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { searchCountries } from "@/features/countries";
import { useSelectedCountryStore } from "@/store/selected-country";

const MAX_RESULTS = 6;

export function useCountrySearch() {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectAndFly = useSelectedCountryStore((state) => state.selectAndFly);

  const results = useMemo(() => searchCountries(query).slice(0, MAX_RESULTS), [query]);
  const showResults = isOpen && query.trim().length > 0;
  const activeCountry = showResults ? results[activeIndex] : undefined;

  function choose(code: string) {
    selectAndFly(code);
    setQuery("");
    setIsOpen(false);
  }

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    setActiveIndex(0);
    setIsOpen(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && activeCountry) {
      event.preventDefault();
      choose(activeCountry.code);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return {
    listboxId,
    query,
    results,
    showResults,
    activeIndex,
    activeCountry,
    setActiveIndex,
    setIsOpen,
    choose,
    updateQuery,
    handleKeyDown,
  };
}

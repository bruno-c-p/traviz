export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function matchRank(searchText: string, normalizedQuery: string): number {
  if (searchText.startsWith(normalizedQuery)) return 0;

  if (searchText.includes(normalizedQuery)) return 1;

  return -1;
}

export function searchByName<T extends { readonly name: string }>(
  pool: readonly T[],
  query: string,
  searchTextOf: (entry: T) => string,
): T[] {
  const normalizedQuery = normalizeSearchText(query.trim());

  if (!normalizedQuery) return [];

  return pool
    .flatMap((entry) => {
      const rank = matchRank(searchTextOf(entry), normalizedQuery);

      return rank >= 0 ? [{ entry, rank }] : [];
    })
    .sort(
      (first, second) =>
        first.rank - second.rank || first.entry.name.localeCompare(second.entry.name),
    )
    .map((match) => match.entry);
}

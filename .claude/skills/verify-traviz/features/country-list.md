# Country list

The `/list` page lists all 250 countries and territories, grouped by continent, with a three-way mark switch on each row. The user narrows the list by continent, by mark status and by name. The list is virtual, so only the rows near the viewport are in the DOM.

## Sub-features

- `list-continent` filters by continent from the `Continents` sidebar on wide screens or the `Continent` chips on narrow screens. Each continent shows `visited / total`.
- `list-status` filters by `Visited`, `Want to go`, `Not interested` and `Unmarked` in the `Filter by status` group. Each button shows a count.
- `list-search` filters by name in the `Search countries` textbox, and `Clear search` empties it.
- `list-virtual` renders only the visible rows and adds rows as the user scrolls.
- `list-mark` sets, changes and clears a mark from a row's `Mark <country>` group.

## How to get to it (user POV)

- Choose the `List` link in the `Main` navigation, or open `/list` signed in.

## Driving it with playwright-core

Preconditions:

- Baseline from the README, with no marks.

- **Search.** Run `page.getByRole("textbox", { name: "Search countries" }).fill("Japan")`, then `settle`. Exactly one group, `Mark Japan`, is visible, and the row shows `JPN` and `Japan`. Click `Clear search`, and the full list returns.
- **Status filter.** In `page.getByRole("group", { name: "Filter by status" })`, click the `Unmarked` button. Its `aria-pressed` turns `true`, and its count matches the number of unmarked countries (250 with no marks).
- **Continent filter.** At 1440 px, click `Asia` in the `Continents` navigation. Its `aria-pressed` turns `true`, and only Asian rows remain. At 375 px, use the `Continent` group of chips.
- **Mark from a row.** In `page.getByRole("group", { name: "Mark Japan" })`, click `page.getByRole("button", { name: "Visited", exact: true })`. After `settle`, its `aria-pressed` is `true`, the `Visited` filter count goes up by 1, and the `Asia` sidebar entry reads `1 / 50`. Click `Visited` again to clear it.
- **Virtual list.** Count `page.getByRole("group", { name: /^Mark / })` with no filter. At 1440 x 900 it is about 19, not 250. Scroll the list with `page.mouse.wheel(0, 5000)`, then `settle`. Rows further down the alphabet appear.
- **Script.** `bun run verify:mark-from-list` runs search, mark, a new-session check and clear, and checks the database row.

## Gotchas

- Rows outside the viewport are not in the DOM. Filter or search before you look for a country, or scroll until its row renders.
- The list counts territories. The sidebar shows `Africa 0 / 59`, while the `/stats` card shows `Africa 0 / 54`. Both are correct.
- Territory rows show a `Territory` tag. They can be marked like countries.
- `Search countries` only filters the list. It does not set a globe fly-to. The globe's search is the `Find a country` combobox on `/`.
- The row switch labels are `Visited`, `Want to go` and `Not interested`. The visible short labels are `Visited`, `Want` and `Skip`. Select by the accessible name.

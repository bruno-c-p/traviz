# Country list

The `/list` page lists all 250 countries and territories, grouped by continent, with a three-way mark switch on each row. The user narrows the list by continent, by mark status and by name. The server renders the first 20 rows and a spacer as tall as the rest, and the browser renders the rest right after hydration. Rows off screen skip layout and paint through `content-visibility: auto`.

## Sub-features

- `list-continent` filters by continent from the `Continents` sidebar on wide screens or the `Continent` chips on narrow screens. Each continent shows `visited / total`.
- `list-status` filters by `Visited`, `Want to go`, `Not interested` and `Unmarked` in the `Filter by status` group. Each button shows a count.
- `list-search` filters by name in the `Search countries` textbox, and `Clear search` empties it.
- `list-rows` renders all rows, grouped by continent, with each continent's header sticky while its rows scroll.
- `list-mark` sets, changes and clears a mark from a row's `Mark <country>` group.

## How to get to it (user POV)

- Choose the `List` link in the `Main` navigation, or open `/list` signed in.

## Driving it with playwright-core

Preconditions:

- Baseline from the README, with no marks.

- **Search.** Run `page.getByRole("textbox", { name: "Search countries" }).fill("Japan")`, then `settle`. Exactly one group, `Mark Japan`, is visible, and the row shows `JPN` and `Japan`. Click `Clear search`, and the full list returns.
- **Status filter.** In `page.getByRole("group", { name: "Filter by status" })`, click `getByRole("button", { name: /^Unmarked/ })`. The button's name includes its count (`Unmarked 250`). Its `aria-pressed` turns `true`, and the count is 250 with no marks. A second click releases it.
- **Continent filter.** At 1440 px, click `page.getByRole("navigation", { name: "Continents" }).getByRole("button", { name: /^Asia/ })`. Its name includes its count (`Asia 0 / 50`). Its `aria-pressed` turns `true`, and the list keeps only the `ASIA` section header and its rows. A second click on Asia does not release it. Click `All countries` in the same navigation to clear the filter. At 375 px, open a second page with `openPage(browser, 375, "reduce")` and `signIn`, and use the `Continent` group of chips. Record that page's `problems` yourself.
- **Mark from a row.** In `page.getByRole("group", { name: "Mark Japan" })`, click `page.getByRole("button", { name: "Visited", exact: true })`. After `settle`, its `aria-pressed` is `true`, the `Visited` filter count goes up by 1, and the `Asia` sidebar entry reads `1 / 50`. Click `Visited` again to clear it.
- **All rows.** Clear every filter first (`All countries`, no status pressed, empty search), or the count measures the filtered list. `page.getByRole("group", { name: /^Mark / })` counts 250, starting with `Mark Algeria`. The list scrolls the inner `[data-panel-scroll]` container. Set its `scrollTop` to 4600 and `settle`, and the `ASIA` header sits at the container's top.
- **Script.** `bun run verify:mark-from-list` runs search, mark, a new-session check and clear, and checks the database row.

## Gotchas

- `bun run verify:shots --route /list` logs a cut at 4000 px at every width. That is expected, because 250 rows are taller than the cap.
- After hydration every row is in the DOM, but a row far off screen is not laid out until it nears the viewport. Search or scroll to it before you click it.
- The list counts territories. The sidebar shows `Africa 0 / 59`, while the `/stats` card shows `Africa 0 / 54`. Both are correct.
- Territory rows show a `Territory` tag. They can be marked like countries.
- `Search countries` only filters the list. It does not set a globe fly-to. The globe's search is the `Find a country` combobox on `/`.
- The row switch labels are `Visited`, `Want to go` and `Not interested`. On wide screens the visible short labels are `Visited`, `Want` and `Skip`, and the row shows the ISO code. At 375 px the switch shows icons only and the code is hidden. Select by the accessible name.

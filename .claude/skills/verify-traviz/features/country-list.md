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
- **Status filter.** In `page.getByRole("group", { name: "Filter by status" })`, click `getByRole("button", { name: /^Unmarked/ })`. The button's name includes its count (`Unmarked 250`). Its `aria-pressed` turns `true`, and the count is 250 with no marks. A second click releases it.
- **Continent filter.** At 1440 px, click `page.getByRole("navigation", { name: "Continents" }).getByRole("button", { name: /^Asia/ })`. Its name includes its count (`Asia 0 / 50`). Its `aria-pressed` turns `true`, and the list keeps only the `ASIA` section header and its rows. A second click on Asia does not release it. Click `All countries` in the same navigation to clear the filter. At 375 px, open a second page with `openPage(browser, 375, "reduce")` and `signIn`, and use the `Continent` group of chips. Record that page's `problems` yourself.
- **Mark from a row.** In `page.getByRole("group", { name: "Mark Japan" })`, click `page.getByRole("button", { name: "Visited", exact: true })`. After `settle`, its `aria-pressed` is `true`, the `Visited` filter count goes up by 1, and the `Asia` sidebar entry reads `1 / 50`. Click `Visited` again to clear it.
- **Virtual list.** Clear every filter first (`All countries`, no status pressed, empty search), or the count measures the filtered list. At the default 1440 x 900 viewport, `page.getByRole("group", { name: /^Mark / })` counts about 19, not 250. The list is grouped by continent, starting with Africa. Move the mouse over a row (the list scrolls an inner container), run `page.mouse.wheel(0, 5000)`, then `settle`. Rows from later continents appear.
- **Script.** `bun run verify:mark-from-list` runs search, mark, a new-session check and clear, and checks the database row.

## Gotchas

- `bun run verify:shots --route /list` logs a cut at 4000 px at every width. That is expected, because 250 rows are taller than the cap.
- Rows outside the viewport are not in the DOM. Filter or search before you look for a country, or scroll until its row renders.
- The list counts territories. The sidebar shows `Africa 0 / 59`, while the `/stats` card shows `Africa 0 / 54`. Both are correct.
- Territory rows show a `Territory` tag. They can be marked like countries.
- `Search countries` only filters the list. It does not set a globe fly-to. The globe's search is the `Find a country` combobox on `/`.
- The row switch labels are `Visited`, `Want to go` and `Not interested`. On wide screens the visible short labels are `Visited`, `Want` and `Skip`, and the row shows the ISO code. At 375 px the switch shows icons only and the code is hidden. Select by the accessible name.

# Stats

The `/stats` page, titled `Your travels`, shows how many of the 195 sovereign countries the user has visited, three totals and one card per continent. The page also holds the account section (`/stats#account`) and the danger zone, which are covered in [auth.md](auth.md) and [marks.md](marks.md).

## Sub-features

- `stats-headline` shows `<n> of 195 · <percent>%` in the `Countries visited` section, with a progress bar. Only sovereign countries count.
- `stats-totals` shows the `Want to go`, `Not interested` and `Visited, incl. territories` tiles.
- `stats-continents` shows a card per continent under `By continent`, with `visited / total`, a bar split by state and `<n> on the wish list · <n> unmarked`.
- `stats-peek` shows the same headline on `/`, with a link to `/stats`. At 1440 px the link is named `See all stats`. At 375 px the whole card is the link, named `<n> of 195 countries visited. See all stats`.

## How to get to it (user POV)

- Choose the `Stats` link in the `Main` navigation, or open `/stats` signed in.
- On `/`, choose `See all stats` in the visited card, or tap the card on a phone.

## Driving it with playwright-core

Preconditions:

- Baseline from the README, with no marks. With no marks, every number is 0 and each continent card reads `0 / <total>`.

- **Headline.** Read `page.getByRole("region", { name: "Countries visited" }).innerText()`. It reads `COUNTRIES VISITED`, `0`, `of 195 · 0.0%`.
- **Make a change.** On `/list`, mark Japan `Visited` and France `Want to go` (see [country-list.md](country-list.md)). Then click the `Stats` link.
- **Totals.** The headline reads `1` and `of 195 · 0.5%`. The tile text `Want to go` is followed by `1`, `Not interested` by `0`, and `Visited, incl. territories` by `1`.
- **Continents.** The `Asia` card reads `1 / 47` and `0 on the wish list · 46 unmarked`. The `Europe` card reads `0 / 45` and `1 on the wish list · 44 unmarked`.
- **Peek link.** On `/` at 375 px, `page.getByRole("link", { name: /countries visited. See all stats/ })` has the name `1 of 195 countries visited. See all stats`. At 1440 px, `page.getByRole("link", { name: "See all stats" })` points to `/stats`.
- **Proof.** Take a screenshot with `bun run verify:shots --route /stats`, then clear both marks.

## Gotchas

- `/stats` counts only countries. `Visited, incl. territories` and the territories card are the only places that count territories. A territory mark changes those, not the headline.
- The continent totals differ from the `/list` sidebar, because the list includes territories.
- The numbers come from the marks in the browser store. They update without a reload, so a correct number does not prove the write reached the database. Check `readMarkRows()` too.

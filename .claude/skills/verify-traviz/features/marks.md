# Marks

A mark records how the user feels about a country: `Visited`, `Want to go` or `Not interested`. The user sets a mark from the globe card, the mobile sheet or a list row. Pressing the active choice clears the mark. `Reset all data` on `/stats` clears every mark. Marks show at once, save to the user's rows in the database and come back after a reload or on another device.

**Needs an update when PR #45 (the marks switch-over) lands.** This file describes `main` at 8d961f6. PR #45 changes how marks sync and cache, and adds saving and failure states. Then re-read `src/features/marks` and rewrite the sub-features, the persistence steps and the gotchas.

## Sub-features

- `marks-set` sets a mark on an unmarked country.
- `marks-change` moves a mark from one state to another.
- `marks-clear` clears a mark by pressing its active choice again, or by `Clear mark` in the globe card or sheet.
- `marks-reset` clears every mark through `Reset all data`, a confirmation and `Yes, erase everything`.
- `marks-persist` keeps marks across a reload and a new session. The `marks` table in `.data/dev.db` holds them, keyed by user and country code.
- `marks-cache` shows cached marks from localStorage key `traviz-marks` before the server snapshot arrives.
- `marks-sync-error` shows `Couldn't sync your latest changes: <reason>` in the `Account` section when a write fails.

## How to get to it (user POV)

- On `/`, select a country (click or search). The card or sheet has the `Mark <country>` group.
- On `/list`, use the row's `Mark <country>` group.
- On `/stats`, scroll to `Danger zone` and choose `Reset all data`.

## Driving it with playwright-core

Preconditions:

- Baseline from the README. `readMarkRows()` returns `[]`.

- **Set.** On `/list`, search `Japan` and click `Visited` in the `Mark Japan` group. After `settle`, `Visited` has `aria-pressed="true"`. Within 5 s, `readMarkRows()` has `{ code: "JPN", state: "visited" }`.
- **Change.** Click `Want to go` in the same group. `Want to go` is pressed, `Visited` is not, and the row's state is `want`.
- **Clear.** Click the pressed `Want to go`. No button is pressed, and the `JPN` row is gone.
- **Persist.** Set a mark, then open a new browser context (`openPage`), sign in and find the same row. The same button is pressed. That is the server snapshot, because the new context has no `traviz-marks` cache.
- **Cache.** After a mark, `localStorage.getItem("traviz-marks")` holds `{"state":{"marks":{"JPN":"visited"}},...}`.
- **Reset.** Mark two countries. On `/stats`, click `Reset all data`, then `Yes, erase everything`. The status `All data has been reset.` appears, every total is 0, and `readMarkRows()` returns `[]`. `Cancel` instead leaves the marks.
- **Globe fill.** After a mark on `/`, the country takes the state's colour (`#9fe870` visited, `#7a5af8` want, `#b9bdb5` not interested). Read a pixel at the projected centre from `page.screenshot({ clip })`, or read `map.getPaintProperty` on the fill layer.
- **Script.** `bun run verify:mark-from-list` runs set, persist and clear, and checks the database at each step.

## Gotchas

- In the mobile sheet the mark buttons are named with their hint, such as `Visited Been there`. Use `{ name: /^Visited/ }` there.
- Wait for the row with a poll of up to 5 s. The screen updates first and the Server Action writes afterward.
- A plain `page.reload()` shows the cached marks from `traviz-marks` before the server snapshot arrives, so it can pass while the server lost the mark. Prove persistence from a new context. The marks actions never call `revalidatePath`, so the open page never refetches on its own.
- `bun run perf` seeds 49 marks for the dev user. If the baseline count is not 0, reset first or report the rows you started with.
- To force `marks-sync-error`, open `/list`, run `bun run verify:server stop`, click a mark, then click the `Stats` link (a client-side navigation still works). The `Account` section shows `Couldn't sync your latest changes: Failed to fetch`, and `traviz-marks` in localStorage still holds the unsaved mark. Run `bun run verify:server start --no-build` afterward. The new server gets a new port.
- Every worktree has its own `.data/dev.db`, but the Clerk dev user is shared. The same user can see different marks in two worktrees.

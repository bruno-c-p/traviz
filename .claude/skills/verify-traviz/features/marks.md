# Marks

A mark records how the user feels about a country: `Visited`, `Want to go` or `Not interested`. The user sets a mark from the globe card, the mobile sheet or a list row. Pressing the active choice clears the mark. `Reset all data` on `/stats` clears every mark. A mark shows at once, saves to the user's rows in the database and comes back after a reload or on another device. A save that fails undoes the colour and shows a short notice on that country.

The code is in `src/features/marks`. `marks-sync.ts` is the pure reducer, `marks-owner.ts` sends one change at a time in tap order, and `marks-store.ts` exposes them as `useCountriesStore`. `MarkStatus` shows a country's saving or failure state.

## Sub-features

- `marks-set` sets a mark on an unmarked country.
- `marks-change` moves a mark from one state to another.
- `marks-clear` clears a mark by pressing its active choice again, or by `Clear mark` in the globe card or sheet.
- `marks-reset` clears every mark through `Reset all data`, a confirmation and `Yes, erase everything`.
- `marks-persist` keeps marks across a reload and a new session. The `marks` table in `.data/dev.db` holds them, keyed by user and country code.
- `marks-saving` shows `Saving…` (a `status`) under the country while its change waits or is on the wire. A change queued behind another one also shows `Saving…`. A pending reset shows it on every country.
- `marks-failure` undoes the colour of a failed change and shows a notice on that country, with a `Dismiss` button. The text depends on the reason: `Couldn't save` (the server was unreachable or refused the change), `Sign in to save` (the session expired) or `Account changed` (another account signed in, for example in another tab). A change with no reply after 8 s fails as `Couldn't save`. If its reply comes later and is ok, the colour comes back and the notice goes. A later successful save on the same country also clears the notice, and so does a successful reset.
- `marks-account-notices` shows a failed reset, and `Couldn't load your latest marks.` when the server snapshot fails, in the `Account` section on `/stats`.
- `marks-cache` keeps the last server marks and their owner in localStorage under `traviz-marks-v2`, as URL-encoded fields such as `AGO=want&DZA=visited&ownerId=user_...`. On a repeat visit the store shows the cache when its module loads, but only when Clerk's `__session` cookie names the same user. The session start then keeps it for that owner and drops it for anyone else. The retired `traviz-marks` key is removed on the next cache write or clear.
- `marks-sign-out` ends the marks session and clears `traviz-marks-v2` once Clerk's sign-out resolves. The next account sees none of the previous account's marks, no selected country and the default globe camera.

## How to get to it (user POV)

- On `/`, select a country (click or search). The card or sheet has the `Mark <country>` group, and the status line sits under it.
- On `/list`, use the row's `Mark <country>` group. The status line sits under the country name.
- On `/stats`, scroll to `Danger zone` and choose `Reset all data`. The `Account` section above it shows account-wide notices.

## Driving it with playwright-core

Preconditions:

- Baseline from the README. `readMarkRows()` returns `[]`.

- **Set.** On `/list`, search `Japan` and click `Visited` in the `Mark Japan` group. After `settle`, `Visited` has `aria-pressed="true"`. Within 5 s, `readMarkRows()` has `{ code: "JPN", state: "visited" }`.
- **Change.** Click `Want to go` in the same group. `Want to go` is pressed, `Visited` is not, and the row's state is `want`.
- **Clear.** Click the pressed `Want to go`. No button is pressed, and the `JPN` row is gone.
- **Persist.** Set a mark, then open a new browser context (`openPage`), sign in and find the same row. The same button is pressed. That is the server snapshot, because the new context has no `traviz-marks-v2` cache.
- **Cache.** After a mark has saved, `localStorage.getItem("traviz-marks-v2")` holds `JPN=visited&ownerId=<the dev user's id>`. `localStorage.getItem("traviz-marks")` is `null`.
- **Saving.** Add latency with CDP `Network.emulateNetworkConditions` (`latency: 3000`), then click a mark. `Saving…` shows under that country until the reply lands, then goes.
- **Failure.** Load `/list`, then call `page.context().setOffline(true)` and click `Visited` in a group. The button goes back to unpressed and `Couldn't save` shows under the country. `readMarkRows()` has no row. `Dismiss` removes the notice. Turn the network back on afterward.
- **Expired session.** Signed in on `/list`, block Clerk's frontend API (`context.route(/clerk\.accounts\.dev/, (route) => route.abort())`) and clear the `__session` cookies (`context.clearCookies({ name: /^__session/ })`). Click a mark. The action answers `signed-out` with status 200, not a redirect, the colour rolls back and `Sign in to save` shows.
- **Sign out.** Set a mark, then on `/stats#account` click `Sign out`. On `/sign-in`, `localStorage.getItem("traviz-marks-v2")` is `null`.
- **Reset.** Mark two countries. On `/stats`, click `Reset all data`, then `Yes, erase everything`. The status `All data has been reset.` appears, every total is 0, and `readMarkRows()` returns `[]`. `Cancel` instead leaves the marks.
- **Globe fill.** After a mark on `/`, the country takes the state's colour (`#9fe870` visited, `#7a5af8` want, `#b9bdb5` not interested). Read a pixel at the projected centre from `page.screenshot({ clip })`, or read `map.getPaintProperty` on the fill layer. After a failed save the fill goes back to the previous colour.
- **Script.** `bun run verify:mark-from-list` runs set, persist and clear, and checks the database at each step.

## Gotchas

- In the mobile sheet the mark buttons are named with their hint, such as `Visited Been there`. Use `{ name: /^Visited/ }` there. At 375 px the globe also renders a hidden card, so pick the visible group.
- Wait for the row with a poll of up to 5 s. The screen updates first and the Server Action writes afterward.
- A plain `page.reload()` shows the cached marks from `traviz-marks-v2` before the server snapshot arrives, so it can pass while the server lost the mark. Prove persistence from a new context. The marks actions never call `revalidatePath`, so the open page never refetches on its own.
- Next runs Server Actions one at a time. While one change hangs, later taps show `Saving…` and wait. They are not lost.
- `verify:server stop` while a page is open makes the next click fail as `Couldn't save`, because the action's fetch fails. Run `bun run verify:server start --no-build` afterward. The new server gets a new port.
- `bun run perf` seeds 49 marks for the dev user. If the baseline count is not 0, reset first or report the rows you started with.
- Every worktree has its own `.data/dev.db`, but the Clerk dev user is shared. The same user can see different marks in two worktrees.

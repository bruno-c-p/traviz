---
name: verify-traviz
description: Launch, drive and capture evidence from traviz, the Next.js and Mapbox app where a signed-in user marks countries on a globe. Drives a local production build in real Chrome through playwright-core. Use it to prove a traviz change works in the browser (the globe on /, the country list on /list, stats on /stats, email-link sign-in, saving marks), to take the 375, 768 and 1440 px screenshots that AGENTS.md requires after a UI change, to pixel-diff two builds, or to check that a local traviz server is healthy before you drive it.
---

# Verify traviz

The surface is the web UI. A user signs in by email link, then marks countries on the globe (`/`), in the list (`/list`) and reads totals on `/stats`. There is no CLI or public API surface to verify. Server Actions are reachable only through the UI.

Run every command from the worktree root. The helpers live in `scripts/verify/` and `src/shared/testing/verify/`, and `bun run check` covers them.

## Launch

```sh
bun install --frozen-lockfile
bun run setup
bun run verify:server start
```

- `bun run setup` writes `.env.local` with Clerk development keys and the Mapbox token. It migrates `.data/dev.db` and creates the dev user `agent+clerk_test@example.com`. It needs the `vercel` and `clerk` CLIs, both logged in. It is safe to run again.
- `verify:server start` refuses a remote database, a database outside `.data/` and a key that is not `pk_test_`. It then runs `bun run build`, starts `next start` on a free port and waits until `/sign-in` answers 200. It is ready when it prints `ready http://localhost:<port> pid <pid>`. The port and PID go to `.data/verify/server.json`. Logs go to `.data/verify/build.log` and `.data/verify/server.log`.
- `verify:server start --no-build` reuses `.next`, but only when this worktree's `.env.local` built it.
- One server runs per worktree, and a second `start` refuses. Separate worktrees run side by side, each with its own port and `.data/dev.db`. All of them share one Clerk dev user.

## Doctor

```sh
bun run verify:doctor
```

The doctor is read-only. Each line starts with `ok` or `FAIL`, and the exit code is 1 when any check fails. It checks that `.env.local` is local only, that `sqlite3` and `clerk` are on PATH, that `.next` holds this worktree's Clerk key (`bun run check` leaves a placeholder build), that the build matches HEAD plus your uncommitted changes, that the recorded PID is alive and owns the port, that `/sign-in` answers 200, and that Chrome launches. Run it first, and again whenever anything looks off. A stale build fails the doctor. Fix it with `bun run verify:server stop`, then `bun run verify:server start`.

## Drive

The driver is `playwright-core` running the installed Google Chrome with SwiftShader WebGL, which is the same browser that `bun run perf` uses. Import from `@/shared/testing/verify/browser`:

- `launchBrowser()` starts headless Chrome.
- `openPage(browser, width, motion)` opens a context at that width. `motion` is `"reduce"` or `"no-preference"`. It returns `{ page, problems }`, where `problems` collects console errors, page errors and responses with status 400 or higher. Mapbox's 404s for empty ocean tiles are left out.
- `signIn(page, baseUrl)` gets a sign-in token for the dev user and signs in through `window.Clerk` with a ticket. No email is sent.
- `settle(page)` waits 700 ms. Call it after every click, keypress or fill before you read state.
- `readCamera(page)` returns `{ lng, lat, zoom, moving, styleLoaded }` for the globe, or `null` when no map is mounted. `findMapExpression` is the in-page expression that finds the mapbox-gl `Map` through the React fiber of `.mapboxgl-map`. Use it in `page.evaluate` to call `project`, `jumpTo` or `queryRenderedFeatures`.
- `readMarkRows()` reads the `marks` table of `.data/dev.db` read-only, as `{ user_id, code, state }[]`.
- `requireBaseUrl()` and `evidenceDirectory(label)` come from `@/shared/testing/verify/instance`. `Journal` from `@/shared/testing/verify/journal` records pass and fail steps and writes `journal.json`.

Select elements by role and accessible name. The handles that matter are listed per feature in [features/README.md](features/README.md). For a journey without a script, put the scratch file in `.data/verify/` (gitignored, and the `@/` alias still resolves) and run it with `bun`.

Ready-made journeys:

```sh
bun run verify:mark-from-list
bun run verify:globe-search
bun run verify:shots --label <name>
bun run verify:pixel-diff <before dir> <after dir>
```

- `verify:mark-from-list [--code JPN --name Japan]` marks a country Visited from `/list` and checks the database row. It reloads and checks the mark is still there, clears it, and checks the row is gone. It stops before it clicks anything when the country already has a row.
- `verify:globe-search [--name Japan --lng 138 --lat 36]` checks that the globe spins, that the search flies to the country and opens its card, that a click on France selects France, and that Zoom in adds one zoom level.
- `verify:shots [--route /list ...] [--motion no-preference]` signs in and takes full-page screenshots of `/`, `/list` and `/stats` (or the routes given) at 375, 768 and 1440 px. Motion is reduced by default.
- `verify:pixel-diff` compares PNGs with the same name in two directories and prints the count of changed pixels and the largest channel delta per file.

## Evidence

Each helper writes to `~/.local/state/traviz/verify/<UTC time>-<label>/` (under `$XDG_STATE_HOME` when that is set) and prints the path. Cleanup never deletes this directory, and removing the worktree leaves it in place. Never write evidence to `/tmp`.

A proof follows these rules:

- Drive the real user path: the button, the search box, a click on the globe. Never call store setters, Server Actions or Clerk APIs other than the ticket sign-in.
- Capture the action and the state after it, such as a screenshot before and after, plus the attribute or text that changed (`aria-pressed`, the card heading, a total).
- Check the side effect next to the screen. A mark is proven only when `readMarkRows()` shows the row, and it persists only when the page still shows it after a reload.
- Report the `problems` list. Any entry in it fails the proof unless you can explain it.
- For a UI change, run `verify:shots` and look at every image for overlap, clipped text and low contrast.

## Cleanup

```sh
bun run verify:server stop
```

`stop` sends SIGTERM to the process group recorded in `.data/verify/server.json`, then SIGKILL after 10 s, and deletes the file. It kills only what `start` launched. Never use `pkill`, `killall` or a kill by port. Close every browser your script opened (`browser.close()`). Restore any marks your journey added, or say in the report that you left them. Evidence stays.

## Rules the earlier runs learned

- Screenshots and pixel diffs of `/` need `prefers-reduced-motion: reduce`, or the spin moves the globe between frames. `verify:shots` reduces motion by default. Use `"no-preference"` only to check the spin.
- Wait at least 700 ms after a click (`settle`). The card, the sheet and the fill colours update after a transition.
- Clerk development returns 429 when the same address submits the email-link form twice in a short time. Give each submit a new address, such as `verify-<epoch ms>+clerk_test@example.com`. A `+clerk_test` address never sends a real email.
- Throttle with CDP `Network.emulateNetworkConditions` and `Emulation.setCPUThrottlingRate` on a `page.context().newCDPSession(page)`. Never throttle with `context.route`, which turns off the HTTP cache.
- To test the moment before the globe's style loads, hold the `mapbox-gl` chunk with CDP `Fetch.enable` on `*/_next/static/chunks/*` and continue the paused request later. The chunk is the file in `.next/static/chunks/` that contains the string `Mapbox GL`.
- Never point a helper at production. The server refuses a non-`file:` database, and `.env.local` never holds `pk_live_` keys. Never copy `.env*` files from another worktree.
- `bun run check` rebuilds `.next` with placeholder keys. After it, run `bun run verify:server stop` and `bun run verify:server start` before you drive again. The doctor catches this.
- `bun run perf -- --baseline <ref>` is the only way to measure performance. It holds a machine-wide lock and builds its own trees. Never measure performance with these helpers. Perf seeds 49 marks into `.data/dev.db` for the dev user, so a later journey can find marks it did not make.

## Feature map

[features/README.md](features/README.md) indexes one file per feature, with sub-features, entry points, driving steps and gotchas. Keep it current with `/maintain-verification-skill` when the UI changes.

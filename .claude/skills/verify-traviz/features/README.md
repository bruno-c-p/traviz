# traviz verification map

This directory is the maintained source for verifying what a traviz user can see and do. Read this index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- `bun run setup` has run in this worktree, and `bun run verify:server start` printed `ready`.
- `bun run verify:doctor` prints only `ok` lines.
- The dev user `agent+clerk_test@example.com` has no marks: `readMarkRows()` returns `[]` (after `bun run setup` that is `sqlite3 .data/dev.db "select count(*) from marks"` printing `0`). If it does not, clear your own leftovers on `/list` by clicking each pressed button again. Use `Reset all data` in the `Danger zone` on `/stats` only when every row is yours to erase. Otherwise report the starting rows.
- Never drive a server that this run did not start, or that `.data/verify/server.json` in this worktree does not record.

## Driving conventions

- Scripts use the helpers in `@/shared/testing/verify/browser` (see the skill's Drive section). Sign in with `signIn(page, baseUrl)`, never through the email form, unless the journey is the email form itself.
- Select by role and accessible name. Every name below is the exact accessible name, except where a file shows a regular expression because the name includes a count.
- Call `settle(page)` after each action, before you read state.
- Use reduced motion for every screenshot of `/`, except when the spin is the thing under test.
- Undo every mark a journey adds. Never delete proof artifacts.

## Proof and skip reporting

- Capture the user action and the resulting state: a screenshot before and after, and the changed attribute or text.
- A mark change also needs the `marks` row from `readMarkRows()`, and persistence needs a new browser context with empty storage.
- Report the `problems` list from `openPage` with each journey.
- Name the feature file, the sub-feature ID and the entry point with every artifact.
- When a precondition is missing, report the journey as failed with the reason. Never weaken a journey so that it passes.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph on what the user sees. It then has exactly four H2 sections in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with playwright-core` (starting with `Preconditions:`), and `Gotchas`.

## Features

- [Globe](globe.md) covers the spinning globe on `/`, picking a country by click or search, the card and the mobile sheet, fly-to and zoom.
- [Country list](country-list.md) covers `/list`: continent and status filters, search, the full list and marking from a row.
- [Stats](stats.md) covers `/stats`: the visited headline, the three totals and the continent cards.
- [Sign-in and sign-out](auth.md) covers the email-link form, the verify page, sign-out and the redirects in the route table.
- [Marks](marks.md) covers setting, changing, clearing and resetting marks, the saving and failure notices, the owner-tagged cache and how marks persist.

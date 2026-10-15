# traviz

traviz is a Next.js 16 app for marking countries on a Mapbox globe as visited, want to go, or not interested. Each Clerk user's marks are stored in a Turso (libSQL) database. Read this file before you change anything. `CLAUDE.md` is a symlink to it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## How the app works

- Routes: `/` (globe), `/list`, `/stats` (the account and reset controls are at `/stats#account`), `/sign-in` and `/sign-in/verify`. `src/proxy.ts` sends signed-out users to `/sign-in` and signed-in users away from it.
- Sign-in uses Clerk email links only. There are no passwords and no social providers. The form is custom code in `src/features/auth`. The root layout sets `prefetchUI={false}`, so Clerk's prebuilt UI bundle never loads.
- Marks are a `Marks` record from `src/lib/colors.ts`, keyed by country code. `src/store/countries.ts` is an optimistic zustand store. It updates the screen first, then calls a Server Action. Writes for one country run in order. Edits made before the first server snapshot are replayed on top of it. The `persist` middleware caches marks in localStorage under `traviz-marks`, so a repeat visit shows them at once.
- The store calls the actions in `src/features/marks/actions` as plain async functions, such as `setMarkAction(code, state)`. They are not form actions. The app has no `useActionState` and no form library. Each action calls `requireUserId` from `@/lib/server/session`, parses its input with the zod schemas in `src/features/marks/schemas.ts`, and writes through `src/features/marks/services/marks.ts`.
- The server snapshot loads in `SessionLayer`. `MarksProvider` reads it with `loadMarks`, and `HydrateMarks` passes it to the store.
- The globe is imperative. `MapCanvas` imports `mapbox-gl` on the client, and `src/lib/mount-globe.ts` creates the map. The `src/lib/map-*` modules bind spin, country events and store sync. React never renders map content. The globe stays mounted on all three app routes and only spins on `/`.
- `next.config.ts` turns on Cache Components and Partial Prefetching. Read request data, such as the session or marks, inside a `<Suspense>` boundary, as `src/app/(app)/layout.tsx` does for `SessionLayer`. Read the matching guide in `node_modules/next/dist/docs/` before you change caching or prefetching.
- Server-only code is `@/lib/server/db` (the Turso client), `@/lib/server/session` and `@/features/marks/services/marks`.

## Commands

| Command                 | What it does                                            |
| ----------------------- | ------------------------------------------------------- |
| `bun run dev`           | Dev server. Needs the `.env.local` values in README.md. |
| `bun run format`        | Format with oxfmt                                       |
| `bun run lint`          | oxlint, with the local `anti-slop` plugin in `tools/`   |
| `bun run typecheck`     | `tsc --noEmit`                                          |
| `bun run check:docs`    | Fail when these docs name a missing path or script      |
| `bun run build`         | Production build                                        |
| `bun run fallow`        | Dead code and complexity report                         |
| `bun run react-doctor`  | React rules                                             |
| `bun run db:migrate`    | Create the `marks` table                                |
| `bun run gen:countries` | Regenerate `src/data/countries.json`                    |

## Rules

- Use bun for every package and script command. Never use npm, pnpm or yarn.
- Import with the `@/` alias, never `../` or `./`. CSS imports and packages are the exception. `@/paths` resolves to `paths.ts` at the repo root, and `@/*` resolves to `src/*`.
- Build every route path with a function from `paths.ts`, such as `listPath()`. Never write a route string inline.
- Use `cn` from `@/lib/utils` for conditional class names.
- Never use a type assertion (`as`) or `any`, except in `paths.ts`. Fix the type with narrowing, generics or `satisfies`.
- Make every data change through a Server Action. Each action lives in `src/features/<name>/actions`, with one verb per file and `"use server"` at the top. Never use a route handler or a client `fetch` for a mutation.
- Each action checks the user with `requireUserId`, validates its input with zod, and only changes rows the user owns.
- Never put `"use server"` on a services or lib module. It turns every export into a public endpoint. Keep `@/lib/server/*` and feature services out of client code.
- The marks actions must not call `revalidatePath` or `refresh`. That would rerun `HydrateMarks`, drop pending writes and load an older snapshot.
- Put one React component in each file. Name the file after it in kebab-case (`country-row.tsx` exports `CountryRow`). Some older files still use PascalCase.
- Model each business operation once (single write path). Prefer one configurable component over near-copies, once a third copy appears.
- Write no comments. Use descriptive names instead of one-letter names, and use `T` for a single generic.
- Do not mock modules in tests. Pass dependencies in as arguments.
- After a UI change, open every affected page in the dev server and screenshot it at 375, 768 and 1440 px. Fix layout breakage, overlap, clipped text and low contrast, then screenshot again. If you cannot run the dev server, say so instead of skipping this.
- Before you report a task as done, run `bun run format`, `bun run lint`, `bun run typecheck` and `bun run check:docs`, and fix what they report.

## Who enforces each rule

"none yet (unit N)" names the unit of the agent-friendly architecture plan that will add the enforcer. "review only" means no tool checks the rule.

| Rule                                              | Enforcer                                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| bun only                                          | CI runs `bun install --frozen-lockfile`. Lockfile and version guard: none yet (unit 8) |
| `@/` imports                                      | none yet (unit 9)                                                                      |
| Route paths from `paths.ts`                       | none yet (unit 16)                                                                     |
| `cn` for conditional classes                      | review only                                                                            |
| No `as` or `any` outside `paths.ts`               | `anti-slop/no-chained-type-assertions` covers part. The rest: none yet (unit 7)        |
| Mutations in `actions/`, `"use server"` placement | none yet (unit 10)                                                                     |
| Actions check the user and validate input         | review only. Unit 17c adds a test for the owner check                                  |
| Server modules stay out of client code            | none yet (unit 3)                                                                      |
| No `revalidatePath` in marks actions              | review only. Unit 21 removes `HydrateMarks`                                            |
| One component per file, kebab-case names          | none yet (unit 9)                                                                      |
| Single write path, configurable components        | review only                                                                            |
| No comments                                       | none yet (unit 10)                                                                     |
| Descriptive names                                 | review only                                                                            |
| No module mocking                                 | `anti-slop/no-module-mocking` in `bun run lint`                                        |
| Screenshots after UI changes                      | review only                                                                            |
| Format, lint, typecheck                           | CI                                                                                     |
| Docs name only real paths and scripts             | `bun run check:docs` in CI                                                             |

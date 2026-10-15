# traviz

traviz is a Next.js 16 app for marking countries on a Mapbox globe as visited, want to go, or not interested. Each Clerk user's marks are stored in a Turso (libSQL) database. Read this file before you change anything. `CLAUDE.md` is a symlink to it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## How the app works

- Routes: `/` (globe), `/list`, `/stats` (the account and reset controls are at `/stats#account`), `/sign-in` and `/sign-in/verify`. `src/proxy.ts` sends signed-out users to `/sign-in` and signed-in users away from it.
- Signed-in pages go under `src/app/(app)/`, whose layout renders the globe shell. `src/proxy.ts` redirects every signed-out request except `/sign-in*`, so a new public page also needs a change there. The nav tabs come from `src/lib/navigation.ts`. A new route needs a function in `paths.ts`, an entry in the routes list above, and a nav entry if it is a tab.
- Sign-in uses Clerk email links only. There are no passwords and no social providers. The form is custom code in `src/features/auth`. The root layout sets `prefetchUI={false}`, so Clerk's prebuilt UI bundle never loads.
- Marks are a `Marks` record from `src/lib/colors.ts`, keyed by country code. `src/store/countries.ts` is an optimistic zustand store. It updates the screen first, then calls a Server Action. Writes for one country run in order. Edits made before the first server snapshot are replayed on top of it. The `persist` middleware caches marks in localStorage under `traviz-marks`, so a repeat visit shows them at once.
- The store calls the actions in `src/features/marks/actions` as plain async functions, such as `setMarkAction(code, state)`. They are not form actions. The app has no `useActionState` and no form library. Each action calls `requireUserId` from `@/lib/server/session`, parses its input with the zod schemas in `src/features/marks/schemas.ts`, and writes through `src/features/marks/services/marks.ts`.
- The server snapshot loads in `SessionLayer`. `MarksProvider` reads it with `loadMarks`, and `HydrateMarks` passes it to the store.
- The globe is imperative. `MapCanvas` imports `mapbox-gl` on the client, and `src/lib/mount-globe.ts` creates the map. The `src/lib/map-*` modules bind spin, country events and store sync. React never renders map content. The globe stays mounted on all three app routes and only spins on `/`.
- `next.config.ts` turns on Cache Components and Partial Prefetching. Read request data, such as the session or marks, inside a `<Suspense>` boundary, as `src/app/(app)/layout.tsx` does for `SessionLayer`. Read the matching guide in `node_modules/next/dist/docs/` before you change caching or prefetching.
- Server-only code is `@/lib/server/db` (the Turso client), `@/lib/server/env`, `@/lib/server/session`, `@/features/marks/services/marks` and `@/features/marks/schemas`. Each one imports `server-only`, so importing it from client code fails the build.

## Commands

| Command                 | What it does                                                                |
| ----------------------- | --------------------------------------------------------------------------- |
| `bun run dev`           | Dev server. Needs the `.env.local` values in README.md.                     |
| `bun run format`        | Format with oxfmt                                                           |
| `bun run lint`          | oxlint with type-aware rules, plus the local `anti-slop` plugin in `tools/` |
| `bun run typecheck`     | `tsc --noEmit`                                                              |
| `bun run check:docs`    | Fail when AGENTS.md, README.md or `docs/` names a missing path or script    |
| `bun run build`         | Production build                                                            |
| `bun run fallow`        | Dead code and complexity report                                             |
| `bun run react-doctor`  | React rules                                                                 |
| `bun run db:migrate`    | Create the `marks` table                                                    |
| `bun run gen:countries` | Regenerate `src/data/countries.json` and `src/data/country-labels.json`     |

`bun run build` and `bun run dev` need `TURSO_DATABASE_URL`, plus `TURSO_AUTH_TOKEN` unless the URL starts with `file:`. `src/lib/server/env.ts` parses them once and throws an error that names any missing one. To build without a database, use the CI values `TURSO_DATABASE_URL=libsql://ci-placeholder.turso.io` and `TURSO_AUTH_TOKEN=ci`. `bun run dev` also needs the Clerk and Mapbox values in README.md.

## Rules

Some older code still breaks these rules, with comments, PascalCase file names and a `../` import in `scripts/migrate.ts`. Do not copy it. The table at the end says which rules a tool checks today.

- Use bun for every package and script command. Never use npm, pnpm or yarn.
- Import with the `@/` alias, never `../` or `./`. CSS imports and packages are the exception. `@/paths` resolves to `paths.ts` at the repo root, and `@/*` resolves to `src/*`.
- Build every route path with a function from `paths.ts`, such as `export const listPath = (): string => "/list";`. Never write a route string inline.
- Use `cn` from `@/lib/utils` for conditional class names.
- Never use a type assertion (`as`) outside `paths.ts`. Never use a non-null assertion (`!`) or `any`. `as const` is fine. Fix the type with narrowing, generics or `satisfies`. Parse an untyped value, such as a `JSON.parse` result, before you use it. Never use `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck`.
- Type the parameter of a `.catch` handler as `unknown`, as in `.catch((error: unknown) => ...)`, and narrow it with `instanceof`. Never type it as `Partial<Error>` or `any`. A helper that takes the caught value names its parameter `cause: unknown`, because `anti-slop/no-unknown-parameters` allows `unknown` only under that name.
- Make every data change through a Server Action. Each action lives in `src/features/<name>/actions`, with one verb per file and `"use server"` at the top. Never use a route handler or a client `fetch` for a mutation.
- Each action checks the user with `requireUserId`, validates its input with zod, and only changes rows the user owns.
- Never put `"use server"` on a services or lib module. It turns every export into a public endpoint. Keep the modules that import `server-only` out of client code.
- The marks actions must not call `revalidatePath` or `refresh`. That would rerun `HydrateMarks`, drop pending writes and load an older snapshot.
- Put one React component in each file. Name the file after it in kebab-case (`src/components/country-row.tsx` exports `CountryRow`).
- Model each business operation once (single write path). Prefer one configurable component over near-copies, once a third copy appears.
- Write no comments. Use descriptive names instead of one-letter names, and use `T` for a single generic.
- Do not mock modules in tests. Pass dependencies in as arguments. The app has no test runner yet. The only tests are the lint rule tests in `tools/oxlint`, and no script runs them.
- After a UI change, open every affected page in the dev server and screenshot it at 375, 768 and 1440 px. Fix layout breakage, overlap, clipped text and low contrast, then screenshot again. If you cannot run the dev server, say so instead of skipping this.
- Before you report a task as done, run `bun run format`, `bun run lint`, `bun run typecheck` and `bun run check:docs`, and fix what they report.

## Who enforces each rule

"none yet" means a check is planned but not added. "review only" means no tool checks the rule and none is planned.

| Rule                                             | Enforcer                                                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bun only                                         | CI runs `bun install --frozen-lockfile`. Lockfile and version guard: none yet                                                                                  |
| `@/` imports                                     | `../`: none yet. `./`: review only                                                                                                                             |
| Route paths from `paths.ts`                      | review only                                                                                                                                                    |
| `cn` for conditional classes                     | review only                                                                                                                                                    |
| No `as` outside `paths.ts`, no `!` or `any`      | `typescript/consistent-type-assertions`, `no-non-null-assertion`, `no-explicit-any`, `ban-ts-comment` and the type-aware `no-unsafe-*` rules in `bun run lint` |
| `.catch` handler parameters are `unknown`        | `typescript/use-unknown-in-catch-callback-variable` and `anti-slop/no-unknown-parameters` in `bun run lint`                                                    |
| `"use server"` only in `actions/` files          | none yet                                                                                                                                                       |
| No route handler or client `fetch` for mutations | review only                                                                                                                                                    |
| Actions check the user and validate input        | review only                                                                                                                                                    |
| Server modules stay out of client code           | `import "server-only"` fails the build. Lint rule: none yet                                                                                                    |
| No `revalidatePath` in marks actions             | review only                                                                                                                                                    |
| One component per file, kebab-case names         | none yet                                                                                                                                                       |
| Single write path, configurable components       | review only                                                                                                                                                    |
| No comments                                      | none yet                                                                                                                                                       |
| Descriptive names                                | review only                                                                                                                                                    |
| No module mocking                                | `anti-slop/no-module-mocking` in `bun run lint` covers `vi.mock` and `jest.mock`. Bun's `mock.module`: none yet                                                |
| Screenshots after UI changes                     | review only                                                                                                                                                    |
| Format, lint, typecheck (`strict` on)            | CI                                                                                                                                                             |
| Docs name only real paths and scripts            | `bun run check:docs` in CI                                                                                                                                     |

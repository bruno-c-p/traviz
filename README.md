# Traviz

Mark the countries you've visited, want to visit, or aren't interested in, on an interactive globe. Your marks sync to your account, so they follow you across devices.

![Globe with visited, want-to-go, and not-interested countries](docs/screenshots/map.png)

## Features

- **Interactive globe.** Spin and zoom the Mapbox globe, then click or tap a country to mark it. The globe keeps spinning until you interact with it.
- **Three states per country.** Visited, Want to go, and Not interested. Select the active state again, or use the clear button, to remove a mark.
- **Searchable list.** Every country grouped by continent, with search and filters by state. Territories are labeled.
- **Stats.** Progress toward the 195 countries in the headline count, with totals per state and a breakdown by continent.
- **Passwordless sign-in.** Enter your email and open the magic link. No passwords.
- **Synced to your account.** Every change is saved to a Turso (libSQL) database.
- **Works on phones.** Countries are marked from a bottom sheet, and a tab bar at the bottom holds the navigation.

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/mark-country.png" alt="Marking France as visited from the globe" /></td>
    <td width="50%"><img src="docs/screenshots/list.png" alt="Country list with search and state filters" /></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><img src="docs/screenshots/stats.png" alt="Stats page with totals and progress by continent" width="50%" /></td>
  </tr>
</table>

<p align="center">
  <img src="docs/screenshots/mobile-sign-in.png" alt="Sign-in screen on a phone" width="220" />
  <img src="docs/screenshots/mobile-map.png" alt="Globe on a phone with the navigation bar" width="220" />
  <img src="docs/screenshots/mobile-mark-country.png" alt="Marking a country from a bottom sheet on a phone" width="220" />
</p>

Screenshots show a demo account with sample marks, captured from a local production build.

## Getting started

### Prerequisites

- Node.js 20.9 or later (required by Next.js 16)
- Bun 1.3 or later
- A Mapbox public access token
- A Turso database
- A Clerk application set up for email link sign-in only

### Install

```bash
bun install
```

### Configure environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_public_token
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token
```

| Variable                            | Purpose                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_MAPBOX_TOKEN`          | Public Mapbox token that renders the globe. Restrict it to your domains in the Mapbox dashboard before going live. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Public Clerk key used to render sign-in and load the session in the browser.                                       |
| `CLERK_SECRET_KEY`                  | Secret Clerk key used on the server to verify sessions. Never expose it to the client.                             |
| `TURSO_DATABASE_URL`                | libSQL URL of the database that stores marks.                                                                      |
| `TURSO_AUTH_TOKEN`                  | Auth token for that database.                                                                                      |

Both Clerk keys are on the API Keys page of your Clerk dashboard.

The Clerk instance must use email link (magic link) sign-in only: no password or social providers.

### Set up the database

```bash
bun run db:migrate
```

This creates the `marks` table, which holds one row per user and country.

### Run locally

```bash
bun run dev
```

Open http://localhost:3000, enter your email, and open the link in the sign-in email.

## Scripts

| Command                 | What it does                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `bun run dev`           | Start the Next.js dev server                                                                               |
| `bun run build`         | Build for production                                                                                       |
| `bun run start`         | Serve the production build                                                                                 |
| `bun run db:migrate`    | Create the `marks` table                                                                                   |
| `bun run gen:countries` | Regenerate `src/data/countries.json` and `src/data/country-labels.json` from the `world-countries` package |
| `bun run lint`          | Lint with Oxlint                                                                                           |
| `bun run format`        | Format with Oxfmt                                                                                          |
| `bun run typecheck`     | Type-check with `tsc --noEmit`                                                                             |
| `bun run check:docs`    | Check that the docs name only paths and scripts that exist                                                 |
| `bun run test`          | Run the bun tests under `src`                                                                              |
| `bun run test:rules`    | Run the lint rule tests in `tools/oxlint` with Node 24                                                     |
| `bun run check:bundle`  | Check the last build's first-load JS and preloads against `bundle-budget.json`                             |
| `bun run check`         | Run every CI check in order, including a build                                                             |

## Country data

`src/data/countries.json` has 250 entries generated from the `world-countries` package. 195 of them count toward the headline total. The other 55 are territories and dependencies: they appear on the map and in the list, but they aren't counted. The same script writes `src/data/country-labels.json`, the name and position of each label on the globe. Both generated files are committed, so only run `bun run gen:countries` after you update that dependency.

## Project structure

```text
.
├── docs/    Screenshots for this README
├── scripts/ Database migration, country generation, and the docs and bundle checks
└── src/
    ├── app/             Routes: / (globe), /list, /stats, and /sign-in
    ├── components/      Shell, globe, list, stats, account, and sign-in components
    ├── features/auth/   Email link sign-in form
    ├── features/marks/  Server Actions and services that save and load marks
    ├── hooks/           Shared React hooks
    ├── lib/             Shared helpers, plus server-only auth and database code
    ├── store/           Zustand store for marks: updates instantly, then syncs
    ├── data/            Generated country list and globe labels
    └── proxy.ts         Sends signed-out users to /sign-in
```

## Deployment

- The project is deployed on Vercel. Any host that runs Next.js works too.
- Set the same environment variables on your host.
- Add your production domain to the Clerk instance in the Clerk dashboard.

## Contributing

Read [AGENTS.md](AGENTS.md) before contributing. It explains how the app works, lists the project's rules, and names the check that enforces each one.

## License

MIT. See [LICENSE](LICENSE).

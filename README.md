# Traviz

A globe visualization app to mark countries as visited, want to visit, or not interested.

## Features

- Interactive Mapbox globe for marking countries
- Three state markers: visited, want to visit, not interested
- Sign-in with data synced to a Turso (libsql) database
- Real-time stats on visit status
- Built with Next.js, React 19, TypeScript, and Tailwind CSS

## Local Setup

### Prerequisites

- Node.js 20+
- pnpm

### Installation

```bash
pnpm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_public_token
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token
BETTER_AUTH_SECRET=your_random_secret
```

- `NEXT_PUBLIC_MAPBOX_TOKEN` — public Mapbox token used to render the globe. Configure URL restrictions in the Mapbox dashboard before going live.
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` — connection details for the Turso database used for auth and marks storage.
- `BETTER_AUTH_SECRET` — secret used by better-auth to sign sessions.

### Database Setup

Run migrations to create the better-auth tables and the `marks` table:

```bash
pnpm db:migrate
```

### Running Locally

```bash
pnpm dev
```

The app starts at `http://localhost:3000`.

### Available Scripts

- `pnpm dev` – Start the Next.js dev server
- `pnpm build` – Build for production
- `pnpm start` – Start the production server
- `pnpm lint` – Run Oxlint code quality checks
- `pnpm format` – Format code with Oxfmt
- `pnpm db:migrate` – Apply better-auth and `marks` table migrations
- `pnpm gen:countries` – Regenerate `src/data/countries.json` from the `world-countries` package

## Data Files

- `src/data/countries.json` – Generated from the `world-countries` npm package and committed to the repository. Regenerate with `pnpm gen:countries` if you update the dependency.

## Technologies

- **Next.js** 16 – Framework (App Router)
- **React** 19 – UI framework
- **TypeScript** – Type safety
- **better-auth** – Authentication
- **Turso / libsql + Kysely** – Database and query builder
- **Mapbox GL** – Globe visualization
- **Tailwind CSS** 4 – Styling
- **Zustand** – State management
- **Motion** – Animations
- **Oxlint** – Code linting
- **Oxfmt** – Code formatting

## License

MIT

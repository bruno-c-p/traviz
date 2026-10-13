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
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token
```

- `NEXT_PUBLIC_MAPBOX_TOKEN` — public Mapbox token used to render the globe. Configure URL restrictions in the Mapbox dashboard before going live.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — public Clerk key used to render sign-in and load the session in the browser.
- `CLERK_SECRET_KEY` — secret Clerk key used on the server to verify sessions. Never expose it to the client.
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` — connection details for the Turso database used for marks storage.

Both Clerk keys are on the API Keys page of your Clerk dashboard.

The Clerk instance must use email link (magic link) sign-in only: no password or social providers.

### Database Setup

Run migrations to create the `marks` table:

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
- `pnpm db:migrate` – Create the `marks` table
- `pnpm gen:countries` – Regenerate `src/data/countries.json` from the `world-countries` package

## Data Files

- `src/data/countries.json` – Generated from the `world-countries` npm package and committed to the repository. Regenerate with `pnpm gen:countries` if you update the dependency.

## Technologies

- **Next.js** 16 – Framework (App Router)
- **React** 19 – UI framework
- **TypeScript** – Type safety
- **Clerk** – Authentication
- **Turso / libsql** – Database
- **Mapbox GL** – Globe visualization
- **Tailwind CSS** 4 – Styling
- **Zustand** – State management
- **Motion** – Animations
- **Oxlint** – Code linting
- **Oxfmt** – Code formatting

## License

MIT

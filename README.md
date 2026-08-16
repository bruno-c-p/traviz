# Traviz

A globe visualization app to mark countries as visited, want to visit, or not interested. All data is stored locally in your browser using localStorage.

## Features

- Interactive Mapbox globe for marking countries
- Three state markers: visited, want to visit, not interested
- Local data persistence via browser localStorage
- JSON export/import for backup and sharing
- Real-time stats on visit status
- Built with React 19, TypeScript, Vite, and Tailwind CSS

## Local Setup

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
pnpm install
```

### Running Locally

```bash
pnpm dev
```

The app will start at `http://localhost:5173`. Hot Module Replacement (HMR) is enabled for instant feedback during development.

### Available Scripts

- `pnpm dev` – Start development server
- `pnpm build` – Build for production (output in `dist/`)
- `pnpm preview` – Preview the production build locally
- `pnpm lint` – Run Oxlint code quality checks
- `pnpm format` – Format code with Oxfmt
- `pnpm test` – Run unit tests with Vitest
- `pnpm test:e2e` – Run end-to-end tests with Playwright
- `pnpm gen:countries` – Regenerate `src/data/countries.json` from the `world-countries` package

## Environment Variables

### `VITE_MAPBOX_TOKEN` (Required for Map Display)

The app uses Mapbox GL for the globe visualization. **A Mapbox API token is required to display the map.**

1. **Locally**, create a `.env.local` file in the project root:
   ```env
   VITE_MAPBOX_TOKEN=pk.your_actual_mapbox_public_token_here
   ```
   The `.env.local` file is gitignored and never committed.

2. **In Vercel production**, the token **must be set** in the Vercel project's **Environment Variables** settings:
   - Navigate to your Vercel project dashboard
   - Go to **Settings** → **Environment Variables**
   - Add `VITE_MAPBOX_TOKEN` with your public Mapbox token
   - Redeploy the project

   Note: `.env.local` is not deployed to Vercel, so environment variables must be configured in the Vercel dashboard for production builds.

### About the Mapbox Token

Vite inlines environment variables prefixed with `VITE_` into the client bundle, so the Mapbox token is publicly visible in the final bundle by design — this is expected for Mapbox public (`pk.*`) tokens. However, **you must configure URL restrictions** in the Mapbox dashboard before going live to prevent token abuse:

1. Log in to [mapbox.com](https://mapbox.com)
2. Navigate to **Account** → **Tokens**
3. Click on your token to edit it
4. Under **Restrictions**, add your production domain(s) under **URL restrictions**
5. This prevents anyone from using your token on other domains

Without URL restrictions, anyone can extract your token from the bundle and use it to incur charges to your Mapbox account.

## Deployment to Vercel

1. Push your repository to GitHub
2. Connect the repository to Vercel
3. **Before deploying**: Add `VITE_MAPBOX_TOKEN` to Vercel's Environment Variables dashboard
4. Deploy (Vercel will automatically detect `vercel.json` and use the correct build settings)

The app is a single-page application (SPA) with client-side routing. The `vercel.json` configuration includes a rewrite rule that ensures deep links (e.g., `/list`, `/stats`) load correctly.

## Data Files

- `src/data/countries.json` – Generated from the `world-countries` npm package and committed to the repository. Regenerate with `pnpm gen:countries` if you update the dependencies.

## Technologies

- **React** 19 – UI framework
- **TypeScript** 6 – Type safety
- **Vite** 8 – Build tool and dev server
- **TanStack Router** – Client-side routing
- **Mapbox GL** – Globe visualization
- **Tailwind CSS** 4 – Styling
- **Zustand** – State management
- **Motion** – Animations
- **Vitest** – Unit testing
- **Playwright** – End-to-end testing
- **Oxlint** – Code linting
- **Oxfmt** – Code formatting

## License

MIT

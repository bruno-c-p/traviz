---
name: feature-folders
description: >
  Co-locate feature code under `features/<name>/` with a standard subdirectory layout.
  Use when creating new feature functionality, adding components or hooks, organizing
  existing flat code into features, or deciding whether code is feature-scoped or shared.
user-invocable: false
---

# Feature Folders

Every feature lives in `features/<feature-name>/` at the project root. The `app/` directory stays thin — route files only, delegating to feature modules.

## Standard layout

```
features/<feature-name>/
  components/      # UI components scoped to this feature
  hooks/           # React hooks scoped to this feature
  actions/         # Server actions, form handlers
  services/        # Data fetching, API clients, business logic
  types.ts         # Feature-specific types and interfaces
  constants.ts     # Feature-specific constants and enums
  index.ts         # Public barrel export for the feature
```

Not every feature needs every subdirectory. Create only what the feature uses — empty directories are dead weight.

## Steps

### 1. Identify the feature

Name the feature by its domain concept, not its UI surface. `meal-log` over `log-page`; `recipe-builder` over `recipe-form`. The name becomes the folder and the import prefix.

Completion criterion: a single feature name chosen, no ambiguity about what domain it covers.

### 2. Scaffold the folder

Create `features/<feature-name>/` with the subdirectories the feature needs. Add an `index.ts` that re-exports the feature's public surface.

Completion criterion: folder exists with the chosen subdirectories and a barrel export.

### 3. Place each piece

| Code type           | Belongs in                     | Not in                       |
| ------------------- | ------------------------------ | ---------------------------- |
| Feature component   | `features/<name>/components/`  | root `components/`           |
| Feature hook        | `features/<name>/hooks/`       | root `hooks/`                |
| Server action       | `features/<name>/actions/`     | inline in route file         |
| API/data service    | `features/<name>/services/`    | `lib/`                       |
| Feature type        | `features/<name>/types.ts`     | scattered in component files |
| Feature constant    | `features/<name>/constants.ts` | magic strings inline         |
| Shared UI primitive | root `components/ui/`          | any feature folder           |
| Shared utility      | root `lib/`                    | any feature folder           |

When a piece looks shared, check: do two different features actually use it _today_? If only one does, it lives in that feature. Move to shared only when a second feature imports it.

Completion criterion: every piece placed according to the table, no feature code in shared directories, no shared code in feature directories.

### 4. Wire the route

Route files in `app/` import from `features/<name>` — they contain no business logic, no data fetching, no feature-specific types. A route file is a thin wrapper: import, compose, render.

```tsx
// app/recipes/page.tsx
import { RecipeList } from "@/features/recipes/components/recipe-list";
import { getRecipes } from "@/features/recipes/services/get-recipes";

export default async function RecipesPage() {
  const recipes = await getRecipes();
  return <RecipeList recipes={recipes} />;
}
```

Completion criterion: route file imports from the feature, contains no logic beyond composition.

### 5. Verify

Run `pnpm typecheck` and `pnpm lint`. Confirm no circular imports between features — features are independent modules that may share only root-level code.

Completion criterion: typecheck and lint pass, no cross-feature imports.

## Migrating existing code

When moving existing flat code into features:

1. Identify which feature each piece belongs to by its domain.
2. Move files to the feature folder.
3. Update all imports — search for the old path, replace with the new `@/features/<name>/...` path.
4. Run `pnpm typecheck` to catch broken imports.
5. Remove the old file only after all imports are updated and typecheck passes.

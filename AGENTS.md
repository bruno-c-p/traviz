Before writing any UI code, read DESIGN.md for design reference.

After any UI change:

1. Start dev server and open every affected page.
2. Screenshot each page at 375px, 768px, and 1440px.
3. Review each screenshot for layout breakage, overlapping
   elements, clipped or overflowing text, and low contrast.
4. Fix what you find, re-screenshot, and confirm fix.
   Do not mark task done until screenshots look correct.

<!-- BEGIN:package-manager -->

# Package Manager: pnpm

This project uses **pnpm**. Always use `pnpm` instead of `npm` for all package management commands (install, add, remove, etc.).
<!-- END:package-manager -->

<!-- BEGIN:absolute-imports -->

# Absolute Imports

Always use absolute imports w/ `@/` alias instead of relative paths (e.g., `../` `./`). Examples:

```ts
// ✅ Good
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ❌ Bad
import { cn } from "../../lib/utils";
import { Button } from "../components/ui/button";
```

Exception: CSS imports (e.g., `import "./globals.css"`) and third-party packages remain unchanged.
<!-- END:absolute-imports -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:paths -->

# Route Paths

Create and use `paths.ts` file at project root to centralize all route paths. Every route must be defined as fn that returns path string. Use these path functions when linking to app routes or external URLs.

```ts
// paths.ts
export const homePath = () => "/";
export const dashboardPath = () => "/dashboard";
export const patientPath = (patientId: string) => `/patients/${patientId}`;
export const patientAppointmentsPath = (patientId: string) => `/patients/${patientId}/appointments`;
```

Usage w/ Next.js Link:

```tsx
import Link from "next/link";
import { patientPath } from "@/paths";

<Link href={patientPath(patientId)}>View Patient</Link>;
```

Benefits:

- Single source of truth for all routes
- Refactoring route changes it everywhere
- Type-safe w/ parameters
- No typos in path strings scattered across components

<!-- END:paths -->

<!-- BEGIN:conditional-styling -->

# Conditional Styling with cn

Always use `cn` utility from `@/lib/utils` for conditional class names in components. It merges Tailwind classes and handles conditional logic cleanly.

```tsx
import { cn } from "@/lib/utils"

// ✅ Good
<div className={cn("base-class", isActive && "active-class", isError && "error-class")} />

// ❌ Bad
<div className={`base-class ${isActive ? "active-class" : ""} ${isError ? "error-class" : ""}`} />
```

Import it as:

```ts
import { cn } from "@/lib/utils";
```

<!-- END:conditional-styling -->

<!-- BEGIN:no-ts-hacks -->

# No TypeScript Type Hacks

Never use type assertions to silence compiler. Avoid `as any` `as never` `as unknown`and similar casts. If type error exists, fix it properly — don't hide it.

```ts
// ❌ Bad
const user = data as any;
const result = response as unknown as MyType;
const value = something as never;

// ✅ Good — use proper typing, narrowing, or generics
const user = data as User;
const result: MyType = response;
const value = something satisfies MyType;
```

If you're unsure how to type something correctly, ask — don't hack around it.

## Sole sanctioned exception: dynamic route paths

w/ `typedRoutes: true`Next resolves `Route` to union of literal route patterns (`"/log/[mealId]"`), so interpolated path can never be proven assignable. Dynamic path functions in `paths.ts` therefore end in `as Route`

```ts
export const mealDetailPath = (mealId: string) => `/log/${mealId}` as Route;
```

Static path functions must use return type annotation instead — they need no cast:

```ts
export const logPath = (): Route => "/log";
```

Do not extend this exception to anything outside `paths.ts`.
<!-- END:no-ts-hacks -->

<!-- BEGIN:server-actions -->

# Server Actions for Mutations

**All data mutations** (create, update, delete, or any server-side state change) go through Server Actions — async functions marked w/ `"use server"`. Never mutate via `fetch`/`axios` from Client Component, and never create `app/api/` route handlers for mutations. Route handlers are only for webhooks and external integrations.

## Where they live

Server Actions live in `features/<name>/actions/<verb>.ts` — **one verb per file**, w/ `"use server"` at top of file (file-level directive, marking every export as Server fn). Import them via absolute paths:

```ts
import { createMeal } from "@/features/meal-log/actions/create-meal";
```

Never inline `"use server"` inside route file, and never mix `"use server"` `"use client"` in same file.

## Form handling

All submitted-form rules live in [`docs/FORM_HANDLING.md`](docs/FORM_HANDLING.md). Read it before creating, refactoring, reviewing, or validating form. It is source of truth for `useActionState`, action-state constructors, validation and unexpected errors, value retention/reset, shadcn `Field` errors, pending submit controls, and success/error feedback callbacks.

## Inside the action

Every Server Action must:

1. **Validate input** — use `zod` w/ `safeParse` (add `zod` to project when first real action lands). Form actions accept `(previousState, formData)` and return their typed state, including submitted values and field/form errors.
2. **Mutate** — write to database via `@/lib/db` or feature `services/` fn.
3. **Revalidate** — call `revalidatePath(paths.x())` from `next/cache` to refresh cached reads (`refresh` from `next/cache` re-renders current router; `revalidateTag`/`updateTag` for tag-based cache). Always pass path strings through `paths.ts` functions.
4. **Redirect** (optional) — `redirect(paths.x())` from `next/navigation` throws and halts execution; call `revalidatePath` first if fresh data is needed before navigating.

```ts
// features/meal-log/actions/create-meal.ts
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logPath, mealDetailPath } from "@/paths";
import { db } from "@/lib/db";
import { zodErrorState } from "@/components/form/utils/to-action-state";

const schema = z.object({
  name: z.string().min(1),
  calories: z.number().int().positive(),
});

export async function createMeal(_: MealFormState, formData: FormData) {
  const values = {
    name: String(formData.get("name") ?? ""),
    calories: String(formData.get("calories") ?? ""),
  };
  const parsed = schema.safeParse({
    name: values.name,
    calories: Number(values.calories),
  });
  if (!parsed.success) {
    return zodErrorState(values, parsed.error);
  }
  const result = await db.execute({
    sql: "INSERT INTO meals (name, calories) VALUES (?, ?)",
    args: [parsed.data.name, parsed.data.calories],
  });
  revalidatePath(logPath());
  redirect(mealDetailPath(String(result.lastInsertRowid)));
}
```

## Security

Server Functions are reachable via direct POST requests — **always verify authentication and authorization inside every action**, never trust client input, and confirm caller owns any resource being mutated. Secrets and server-only imports (`@/lib/db`) must never appear in file w/o `"use server"`.

Full guide w/ rationale, anti-patterns, and deeper examples: `docs/ARCHITECTURE.md` § Server Actions for Mutations.
<!-- END:server-actions -->

<!-- BEGIN:one-component-per-file -->

# One Component Per File

Every React component lives in its own file, named in kebab-case after component (`meal-detail.tsx` exports `MealDetail`). file exports exactly one component.

- **Never declare second component in file**, not even small presentational helper used once. Extract it into sibling file and import it.
- Components used by single feature live in `features/<name>/components/`shared ones in `components/`.
- Non-component code that belongs to component (types, constants, small pure helpers) may stay in same file.

```tsx
// ❌ Bad — features/progress/components/progress-overview.tsx
export function ProgressOverview() { ... }
function StatCard({ label, value }: StatCardProps) { ... }

// ✅ Good — features/progress/components/stat-card.tsx
export function StatCard({ label, value }: StatCardProps) { ... }

// ✅ Good — features/progress/components/progress-overview.tsx
import { StatCard } from "@/features/progress/components/stat-card"
export function ProgressOverview() { ... }
```

Exception: `components/ui/*` (shadcn) ships multi-export files — leave them as they are.
<!-- END:one-component-per-file -->

<!-- BEGIN:config-over-composition -->

# Configuration over Composition

Prefer configuring single component through props over composing new wrapper components — but apply this wisely, only once duplication appears. Do not generalize preemptively: write straightforward version first, and consolidate into configurable component only when same structure is about to be duplicated third time (rule of three).

- When several components differ only in data (labels, values, icons, colors), merge them into one component that takes props.
- Keep config surface small: plain props first, config object when props grow past handful, discriminated union (`variant`) for genuinely different behavior. Do not reach for render props or slots until config object cannot express need.
- If consolidating would require more conditional branching inside component than duplication it removes, keep components separate.

```tsx
// ❌ Bad — three near-identical composed components
export function ProteinStatCard() { ... }
export function CarbStatCard() { ... }
export function FatStatCard() { ... }

// ✅ Good — one configurable component
export function MacroStatCard({ label, value, unit }: MacroStatCardProps) { ... }
```

<!-- END:config-over-composition -->

<!-- BEGIN:single-write-path -->

# Single Write Path

Model each business operation once. When create and update accept same payload and differ only by whether record already exists, use one upsert action/service keyed by stable unique identity instead of parallel create/update implementations.

- Share validation, input mapping, persistence, cache revalidation, and form structure across one logical write flow.
- Keep separate operations only when their authorization, lifecycle rules, validation, side effects, or record identity meaningfully differ.
- Confirm database unique constraint and conflict behavior before choosing upsert; upsert must preserve intended owner and never overwrite different record.

<!-- END:single-write-path -->

<!-- BEGIN:no-comments -->

# No Comments

Never add comments to project code. Write self-documenting code w/ clear names instead.
<!-- END:no-comments -->

<!-- BEGIN:descriptive-names -->

# Descriptive Names

Use descriptive names for every variable, param, callback value, and index. Prefer domain terms that explain value's role; one-character names obscure intent. Use names such as `meal` `macro` `preference` `index` `event`. Use `_` only for deliberately unused value.

Use `T` for a single generic type parameter. Use descriptive generic names only when a type has multiple generic parameters that need to be distinguished.
<!-- END:descriptive-names -->

<!-- BEGIN:post-task-checks -->

# Post-Task Checks

Always run lint and format after finishing task, before reporting completion:

```sh
pnpm lint
pnpm format
```

Fix any issues they surface (use `pnpm lint:fix` for auto-fixable lint errors). If task changed TypeScript code, also run `pnpm typecheck`.
<!-- END:post-task-checks -->

<!-- BEGIN:form-submission -->

Read [`docs/FORM_HANDLING.md`](docs/FORM_HANDLING.md) for all form submission rules, including component placement, action state, validation/error mapping, value retention, shadcn field errors, pending submit controls, and success/error feedback callbacks.
<!-- END:form-submission -->

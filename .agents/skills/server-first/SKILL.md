---
name: server-first
description: >
  Server-First Components: enforce Server Component default in Next.js, minimize "use client" directives,
  apply composition patterns to keep interactive wrappers small, and route all data mutations through
  Server Actions. Fire when creating new components, building forms, writing mutation logic, or
  refactoring Client Components.
user-invocable: false
---

# Server-First Components

Start with Server Components. Only add `"use client"` when you have a specific reason.

**Reads are Server Components. Writes are Server Actions.** There is no third mutation path.

## Steps

### 1. Assess mutations

If the task writes, creates, updates, or deletes data → it MUST be a Server Action in `features/<name>/actions/<verb>.ts` (one verb per file, `"use server"` at the top of the file). Never mutate via `fetch` from a Client Component. Never create `app/api/` route handlers for mutations.

Read [`../../../docs/FORM_HANDLING.md`](../../../docs/FORM_HANDLING.md) before creating, refactoring, reviewing, or validating any submitted form. It is the source of truth for the `useActionState` form boundary, action-state shape/constructors, errors, value retention/reset, shadcn fields, pending controls, and success/error feedback callbacks.

Completion criterion: the form follows every requirement in `docs/FORM_HANDLING.md`.

### Form submission state

Apply the submit-state requirements in [`../../../docs/FORM_HANDLING.md`](../../../docs/FORM_HANDLING.md).

### 2. Select the write path

When create and update accept the same payload, first verify that they represent one business operation and have a stable unique identity. Inspect the unique constraint, ownership rule, and conflict behavior before selecting an upsert.

Use one action/service only when authorization, lifecycle rules, validation, side effects, and ownership are the same. Keep distinct operations when any of those differ.

Completion criterion: each write is classified as one safe upsert path or distinct operations, with its identity and ownership protection verified.

### 3. Assess component type

Before writing or modifying a component, determine what it needs:

- Does it fetch data? → Server Component
- Does it use `async/await`? → Server Component
- Does it access secrets or env vars? → Server Component
- Does it need `useState`, `useEffect`, event handlers, or browser APIs? → Client Component
- Does it wrap children in a Provider? → Client wrapper + Server children (composition)
- Does it mutate data? → Server Action in `features/<name>/actions/` (see step 1)

Completion criterion: classification of the component as Server or Client with justification.

### 4. Check for Composition

If the component needs some interactivity but also has static or data-fetching parts, apply the composition pattern:

1. Extract the minimal interactive part into a small Client Component
2. Keep the data-fetching and static rendering in a Server Component parent
3. Pass Server Components as `children` to the Client wrapper

The goal: minimize the surface area of `"use client"` to the smallest possible boundary.

Completion criterion: interactive code isolated in a focused Client Component; data fetching remains server-side.

### 5. Validate Placement

Check the component against these rules:

| Scenario                                   | Correct placement                           |
| ------------------------------------------ | ------------------------------------------- |
| Data fetching                              | Server Component                            |
| `useState` / `useReducer`                  | Client Component                            |
| `useEffect`                                | Client Component                            |
| Event handlers (`onClick`, `onChange`)     | Client Component                            |
| Browser APIs (`localStorage`, `navigator`) | Client Component                            |
| Context Providers                          | Client wrapper with Server children         |
| Static rendering                           | Server Component                            |
| Conditional rendering based on props       | Server Component                            |
| Redirects                                  | Server Component with `redirect()`          |
| Mutations (write/create/update/delete)     | Server Action in `features/<name>/actions/` |

Completion criterion: component placed correctly according to the table.

### 6. Verify No Anti-Patterns

Scan for these violations:

- **Entire page wrapped in `"use client"`** — extract interactivity to a child
- **Nested `"use client"` boundaries** — redundant; child inherits from parent
- **`await` in Client Components** — move data fetching to Server parent
- **Secrets exposed in Client Components** — move to Server Component
- **Missing composition opportunity** — if a Client wrapper has Server-renderable content as children, pass it as `children`
- **Mutating via `fetch` from a Client Component** — use a Server Action instead
- **`app/api/` route handler for a mutation** — use a Server Action (route handlers are for webhooks/external integrations only)
- **Inline `"use server"` inside a route file** — Server Actions must live in `features/<name>/actions/<verb>.ts`
- **`"use server"` and `"use client"` in the same file** — mutually exclusive directives
- **Server-only imports (`@/lib/db`) in a file without `"use server"`** — secrets must stay server-side

Completion criterion: no anti-patterns present in the component or its immediate neighbors.

### 7. Run Checks

Run the type checker and linter to confirm the component compiles correctly:

```bash
pnpm typecheck && pnpm lint
```

Completion criterion: both commands pass with no new errors.

## Decision Tree

```
0. Does this mutate data (write/create/update/delete)?
   → Yes → Server Action in features/<name>/actions/<verb>.ts; user-submitted form → focused Client Component using useActionState → done
   → No → continue to step 1

1. Does this component need interactivity?
   → No → Server Component ✅
   → Yes → Continue to step 2

2. Does it need browser APIs or event handlers?
   → No → Server Component ✅
   → Yes → Continue to step 3

3. Can I extract just the interactive part and use composition?
   → Yes → Use Composition Pattern ⭐
   → No → Client Component

4. Is this a Provider, Theme, or Context wrapper?
   → Yes → Client Component wrapper + Server Component children
   → No → Client Component
```

## Composition Patterns

### Provider with Server Children

```jsx
// lib/providers/ThemeProvider.tsx
"use client";
import { createContext, useState } from "react";

export const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
```

```jsx
// app/layout.tsx (Server)
import { ThemeProvider } from "@/lib/providers/ThemeProvider";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

### Interactive Wrapper with Server Content

```jsx
// components/ModalContainer.tsx
"use client";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";

export function ModalContainer({ trigger, children }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>{children}</DialogContent>
    </Dialog>
  );
}
```

```jsx
// components/PostsList.tsx (Server)
import { ModalContainer } from "./ModalContainer";

export async function PostsList() {
  const posts = await getPosts();
  return (
    <ModalContainer trigger={<button>View Posts</button>}>
      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </ModalContainer>
  );
}
```

### Isolated Interactive Island

```jsx
// components/ProductCard.tsx (Server)
import { AddToCartButton } from "./AddToCartButton";

export function ProductCard({ product }) {
  return (
    <div className="border p-4">
      <h2>{product.name}</h2>
      <p>${product.price}</p>
      <AddToCartButton productId={product.id} />
    </div>
  );
}
```

```jsx
// components/AddToCartButton.tsx (Client - small & focused)
"use client";
import { useShoppingCart } from "@/hooks/useShoppingCart";

export function AddToCartButton({ productId }) {
  const { addToCart } = useShoppingCart();
  return <button onClick={() => addToCart(productId)}>Add to Cart</button>;
}
```

## Streaming with Suspense

Server Components with `Suspense` enable **progressive rendering** — stream parts of the page as data becomes available instead of blocking until everything is ready.

### When to Use Suspense

Use `Suspense` boundaries when:

1. **Slow data fetches** that would block the page
2. **Independent data** that doesn't need to load together
3. **Below-the-fold content** that doesn't affect initial page render
4. **Database queries** that might be slow
5. **External API calls** with unpredictable latency

**Don't use Suspense when:**

- Data fetches are already fast (< 100ms)
- Data is critical for initial render
- User needs to see full page before interacting

### Suspense + Composition Pattern

```jsx
// components/ProductPage.tsx (Server)
import { Suspense } from "react";
import { ProductHeader } from "./ProductHeader";
import { ProductDetails } from "./ProductDetails";
import { RelatedProducts } from "./RelatedProducts";
import { ProductSkeleton, RelatedSkeleton } from "./Skeletons";

export default async function ProductPage({ params }) {
  const product = await getProduct(params.id);

  return (
    <main>
      <ProductHeader product={product} />

      <Suspense fallback={<ProductSkeleton />}>
        <ProductDetails productId={params.id} />
      </Suspense>

      <Suspense fallback={<RelatedSkeleton />}>
        <RelatedProducts productId={params.id} />
      </Suspense>
    </main>
  );
}
```

### Nested Suspense Boundaries

```jsx
// components/Dashboard.tsx (Server)
import { Suspense } from "react";

export default function Dashboard() {
  return (
    <div className="grid gap-6">
      <Suspense fallback={<StatsSkeleton />}>
        <UserStats />
      </Suspense>
      <Suspense fallback={<ActivitySkeleton />}>
        <RecentActivity />
      </Suspense>
      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations />
      </Suspense>
    </div>
  );
}
```

### Suspense with Client Components

```jsx
// components/FilterableList.tsx (Client)
"use client";
import { Suspense, useState } from "react";

export function FilterableList() {
  const [category, setCategory] = useState("all");

  return (
    <div>
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="all">All</option>
        <option value="tech">Tech</option>
      </select>

      <Suspense fallback={<PostSkeleton />} key={category}>
        <FilteredPosts category={category} />
      </Suspense>
    </div>
  );
}
```

Key: `key={category}` forces Suspense to reset when category changes.

### Always Use Skeleton Loading States

**Never use plain text fallbacks like `<div>Loading...</div>`.**

Every `Suspense` fallback must use a skeleton loader that:

- Matches the final layout — same dimensions, structure, and spacing
- Shows content structure — placeholder lines, cards, or blocks
- Reduces layout shifts — skeleton occupies the same space as real content
- Improves perceived performance — users see progress, not a blank stare

```jsx
// ❌ WRONG
<Suspense fallback={<div>Loading...</div>}>
  <UserList />
</Suspense>

// ✅ CORRECT
<Suspense fallback={<UserListSkeleton />}>
  <UserList />
</Suspense>
```

### Streaming Anti-Patterns

- **Plain text fallbacks** (`<div>Loading...</div>`) — always use skeletons
- **Suspense boundary too high** — one slow component blocks everything
- **Fallback too different from content** — causes layout shift
- **Missing Suspense on slow fetches** — page blocks unnecessarily

### Streaming Best Practices

1. **Granular boundaries** — wrap only slow components, not entire sections
2. **Match skeleton layout** — fallback UI should mirror actual content structure
3. **Priority matters** — load critical above-the-fold content first
4. **Use `useTransition`** — for Client Component-triggered server updates
5. **Keep fallbacks fast** — skeleton UI should be tiny and instant

## Valid Reasons for "use client"

1. `useState` or `useReducer` — state management
2. `useEffect` — side effects or lifecycle
3. Event handlers — `onClick`, `onChange`, `onSubmit`
4. Browser APIs — `localStorage`, `navigator`, `window`
5. Context Providers — wrapping children with shared state

## Invalid Reasons (Stay Server)

- Just fetching data
- Conditional rendering based on props
- Static content
- Passing props down
- Simple redirects

## Server Action Integration Patterns

Read [`../../../docs/FORM_HANDLING.md`](../../../docs/FORM_HANDLING.md) for the required form pattern and examples. Read `docs/ARCHITECTURE.md` § Server Actions for Mutations for the broader mutation, security, and cache rules.

## Reference

Full architecture documentation: [docs/ARCHITECTURE.md](../../../docs/ARCHITECTURE.md)

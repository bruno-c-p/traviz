# Architecture Guidelines: Server-First Components

## Core Philosophy

**Start with Server Components. Only add `"use client"` when you have a specific reason.**

Server Components are the default in Next.js 13+. They provide:

- ✅ **Less JavaScript** sent to the browser
- ✅ **Direct database access** without API routes
- ✅ **Secure secrets** kept server-side (API keys, tokens)
- ✅ **Better performance** and SEO
- ✅ **Reduced client-side complexity**

---

## Decision Tree

Before creating a component, ask yourself:

```
1. Does this component need interactivity?
   → No → Server Component ✅
   → Yes → Continue to step 2

2. Does it need browser APIs or event handlers?
   → No → Server Component ✅
   → Yes → Continue to step 3

3. Can I extract just the interactive part and use composition?
   → Yes → Use Composition Pattern (see below) ⭐
   → No → Client Component

4. Is this a Provider, Theme, or Context wrapper?
   → Yes → Client Component wrapper + Server Component children (Composition Pattern)
   → No → Client Component
```

---

## Composition Pattern with Children (⭐ PRIMARY PATTERN)

This is the **gold standard** for minimizing `"use client"`. The idea: keep interactive wrappers small, pass Server Components as children.

### Pattern Structure

```
ServerPage (Server Component)
├── InteractiveProvider (Client Component - "use client")
│   └── ServerContent (Server Component)
│       ├── ServerData (Server Component)
│       └── InteractiveWidget (Client Component - "use client")
```

### Example 1: Theme Provider

**❌ WRONG - Entire page is Client:**

```jsx
// app/page.tsx
"use client";

export default function Page() {
  const [theme, setTheme] = useState("light");
  const data = await fetchData(); // ❌ Can't use await in Client Component

  return (
    <ThemeContext.Provider value={theme}>
      <ServerContent data={data} />
    </ThemeContext.Provider>
  );
}
```

**✅ CORRECT - Minimal Client wrapper:**

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
// app/layout.tsx (Server Component)
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

```jsx
// app/page.tsx (Server Component)
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function Page() {
  const data = await fetchData(); // ✅ This works!

  return (
    <main>
      <ThemeToggle /> {/* Small Client Component */}
      <ServerContent data={data} />
    </main>
  );
}
```

### Example 2: Modal with Server Content

**❌ WRONG - Entire modal is Client:**

```jsx
"use client";

export default function PostModal() {
  const [open, setOpen] = useState(false);
  const posts = await getPosts(); // ❌ Can't await

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        {posts.map(post => <PostCard key={post.id} post={post} />)}
      </DialogContent>
    </Dialog>
  );
}
```

**✅ CORRECT - Small Client wrapper + Server content:**

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
// components/PostsList.tsx (Server Component)
import { ModalContainer } from "./ModalContainer";
import { PostCard } from "./PostCard";

export async function PostsList() {
  const posts = await getPosts(); // ✅ Works!

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

### Example 3: Navigation with Interactive State

**❌ WRONG - Entire layout is Client:**

```jsx
"use client";

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const navItems = await getNavItems(); // ❌ Can't await

  return (
    <nav>
      <button onClick={() => setOpen(!open)}>Menu</button>
      {open && navItems.map(item => <NavLink key={item.id} item={item} />)}
    </nav>
  );
}
```

**✅ CORRECT - Small interactive wrapper + Server nav:**

```jsx
// components/MobileMenuToggle.tsx
"use client";

import { useState } from "react";

export function MobileMenuToggle({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(!open)} className="md:hidden">
        Menu
      </button>
      {open && children}
    </>
  );
}
```

```jsx
// components/Navigation.tsx (Server Component)
import { MobileMenuToggle } from "./MobileMenuToggle";
import { NavLink } from "./NavLink";

export async function Navigation() {
  const navItems = await getNavItems(); // ✅ Works!

  return (
    <nav>
      <MobileMenuToggle>
        <div className="flex flex-col gap-2">
          {navItems.map((item) => (
            <NavLink key={item.id} item={item} />
          ))}
        </div>
      </MobileMenuToggle>
    </nav>
  );
}
```

---

## Streaming with Suspense (Progressive Rendering)

Server Components with `Suspense` allow you to stream parts of the page to the browser as data becomes available. This provides **progressive rendering** instead of blocking until everything is ready.

### Why Streaming?

**Without Streaming:**

```
Wait for all data → Render entire page → Send to browser
⏳ User sees blank page while waiting
```

**With Streaming:**

```
Render fast content → Send immediately → Stream slow data → Stream update
✅ User sees content faster, feels more responsive
```

### Benefits

- ✅ **Faster First Paint** - Show UI shell while fetching data
- ✅ **Better Perceived Performance** - Progressive loading feels faster
- ✅ **SEO Friendly** - Streaming sends initial HTML to search engines
- ✅ **Graceful Degradation** - Fallback UI for slow data
- ✅ **Improved Core Web Vitals** - Better LCP and FID

### When to Use Suspense

Use `Suspense` boundaries when:

1. **Slow data fetches** that would block the page
2. **Independent data** that doesn't need to load together
3. **Below-the-fold content** that doesn't affect initial page render
4. **Database queries** that might be slow
5. **External API calls** with unpredictable latency

**Don't use Suspense when:**

- ❌ Data fetches are already fast (< 100ms)
- ❌ Data is critical for initial render
- ❌ User needs to see full page before interacting

### Pattern: Suspense + Composition

```jsx
// components/ProductPage.tsx (Server)
import { Suspense } from "react";
import { ProductHeader } from "./ProductHeader";
import { ProductDetails } from "./ProductDetails";
import { RelatedProducts } from "./RelatedProducts";
import { ProductSkeleton, RelatedSkeleton } from "./Skeletons";

export default async function ProductPage({ params }) {
  // Fast fetch - no suspense needed
  const product = await getProduct(params.id);

  return (
    <main>
      {/* Critical content - no suspense */}
      <ProductHeader product={product} />

      {/* Slower content - wrapped in Suspense */}
      <Suspense fallback={<ProductSkeleton />}>
        <ProductDetails productId={params.id} />
      </Suspense>

      {/* Independent data - separate Suspense boundary */}
      <Suspense fallback={<RelatedSkeleton />}>
        <RelatedProducts productId={params.id} />
      </Suspense>
    </main>
  );
}
```

### Example 1: Progressive List Loading

```jsx
// components/PostList.tsx (Server)
import { Suspense } from "react";
import { PostCard } from "./PostCard";
import { PostSkeleton } from "./PostSkeleton";

async function Posts() {
  // This fetch might be slow
  const posts = await getPosts();

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

export function PostList() {
  return (
    <section>
      <h2>Recent Posts</h2>
      <Suspense fallback={<PostSkeleton />}>
        <Posts />
      </Suspense>
    </section>
  );
}
```

Browser behavior:

1. Show heading immediately
2. Show skeleton loader
3. Once `Posts` data arrives, swap skeleton for actual posts
4. User sees progressive content loading

### Example 2: Nested Suspense Boundaries

```jsx
// components/Dashboard.tsx (Server)
import { Suspense } from "react";
import { UserStats } from "./UserStats";
import { RecentActivity } from "./RecentActivity";
import { Recommendations } from "./Recommendations";

export default function Dashboard() {
  return (
    <div className="grid gap-6">
      {/* Critical - fastest fetch */}
      <Suspense fallback={<StatsSkeleton />}>
        <UserStats />
      </Suspense>

      {/* Secondary - slower fetch */}
      <Suspense fallback={<ActivitySkeleton />}>
        <RecentActivity />
      </Suspense>

      {/* Tertiary - slowest fetch */}
      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations />
      </Suspense>
    </div>
  );
}
```

Each section loads independently:

- Stats load first → show immediately
- Activity loads second → user can already see stats
- Recommendations load third → user can interact with other sections

### Example 3: Suspense with Client Components

Suspense works great with composition pattern:

```jsx
// components/FilterableList.tsx (Client)
"use client";

import { Suspense, useState } from "react";
import { FilteredPosts } from "./FilteredPosts";
import { PostSkeleton } from "./PostSkeleton";

export function FilterableList() {
  const [category, setCategory] = useState("all");

  return (
    <div>
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="all">All</option>
        <option value="tech">Tech</option>
        <option value="design">Design</option>
      </select>

      {/* Server Component inside Client, wrapped in Suspense */}
      <Suspense fallback={<PostSkeleton />} key={category}>
        <FilteredPosts category={category} />
      </Suspense>
    </div>
  );
}

// components/FilteredPosts.tsx (Server)
async function FilteredPosts({ category }) {
  const posts = await getPosts({ category });
  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
```

Key: `key={category}` forces Suspense to reset when category changes, showing fallback while new data loads.

### Example 4: Search with Streaming Results

```jsx
// components/SearchResults.tsx (Client)
"use client";

import { Suspense, useTransition } from "react";
import { ResultsList } from "./ResultsList";
import { SearchSkeleton } from "./SearchSkeleton";

export function SearchResults() {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSearch = (newQuery) => {
    setQuery(newQuery);
    startTransition(() => {
      // Triggers server re-render with new query
    });
  };

  return (
    <div>
      <input value={query} onChange={(e) => handleSearch(e.target.value)} placeholder="Search..." />

      {query && (
        <Suspense fallback={<SearchSkeleton />}>
          <ResultsList query={query} />
        </Suspense>
      )}
    </div>
  );
}

// components/ResultsList.tsx (Server)
async function ResultsList({ query }) {
  const results = await searchPosts(query); // Server-side search
  return (
    <div className="space-y-2">
      {results.map((result) => (
        <SearchResult key={result.id} result={result} />
      ))}
    </div>
  );
}
```

### Always Use Skeleton Loading States

**Never use plain text fallbacks like `<div>Loading...</div>`.**

Every `Suspense` fallback must use a skeleton loader that:

- ✅ **Matches the final layout** — same dimensions, structure, and spacing
- ✅ **Shows content structure** — placeholder lines, cards, or blocks that mirror real content
- ✅ **Reduces layout shifts** — skeleton occupies the same space as the real content
- ✅ **Improves perceived performance** — users see progress, not a blank stare

```jsx
// ❌ WRONG — jarring layout shift, no visual feedback
<Suspense fallback={<div>Loading...</div>}>
  <UserList />
</Suspense>

// ❌ WRONG — generic spinner doesn't show structure
<Suspense fallback={<Spinner />}>
  <DashboardCards />
</Suspense>

// ✅ CORRECT — skeleton matches final layout
<Suspense fallback={<UserListSkeleton />}>
  <UserList />
</Suspense>

// ✅ CORRECT — skeleton mirrors card grid
<Suspense fallback={<DashboardCardsSkeleton />}>
  <DashboardCards />
</Suspense>
```

### Anti-Patterns to Avoid

#### ❌ Don't: Suspense boundary too high in tree

```jsx
// Entire page waits for slowest data
<Suspense fallback={<PageSkeleton />}>
  <Header />
  <Sidebar />
  <MainContent />
  <SlowData /> {/* One slow component blocks everything */}
</Suspense>
```

#### ✅ Do: Granular Suspense boundaries

```jsx
// Each section loads independently
<Header />
<Suspense fallback={<SidebarSkeleton />}>
  <Sidebar />
</Suspense>
<Suspense fallback={<ContentSkeleton />}>
  <MainContent />
</Suspense>
<Suspense fallback={<SlowSkeleton />}>
  <SlowData />
</Suspense>
```

#### ❌ Don't: Suspense fallback too different from content

```jsx
// Jarring layout shift
<Suspense fallback={<div>Loading...</div>}>
  <GridLayout columns={4} />
</Suspense>
```

#### ✅ Do: Skeleton that matches final layout

```jsx
// Smooth progressive loading
<Suspense fallback={<GridSkeleton columns={4} />}>
  <GridLayout columns={4} />
</Suspense>
```

### Streaming Best Practices

1. **Identify slow operations** - Profile data fetches to find bottlenecks
2. **Granular boundaries** - Wrap only slow components, not entire sections
3. **Match skeleton layout** - Fallback UI should mirror actual content structure
4. **Priority matters** - Load critical above-the-fold content first
5. **Use `useTransition`** - For Client Component-triggered server updates
6. **Test on slow networks** - Streaming is most valuable on 3G/4G
7. **Keep fallbacks fast** - Skeleton UI should be tiny and instant

### Combining Streaming + Composition

The most powerful pattern: **Streaming Server Components inside Composition wrappers**

```jsx
// app/layout.tsx (Server)
import { Providers } from "@/lib/providers/Providers";

export default function Layout({ children }) {
  return (
    <html>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

// app/dashboard/page.tsx (Server)
import { Suspense } from "react";

export default function Dashboard() {
  return (
    <div className="grid gap-6">
      <Suspense fallback={<CardSkeleton />}>
        <Analytics /> {/* Server Component, slow fetch */}
      </Suspense>

      <Suspense fallback={<CardSkeleton />}>
        <RecentActivity /> {/* Server Component, slow fetch */}
      </Suspense>
    </div>
  );
}

// components/ThemeToggle.tsx (Client - small interactive island)
"use client";

export function ThemeToggle() {
  // Access theme context from Providers
  // Minimal interactivity
}
```

Result: ✅ Server-first architecture + Progressive rendering + Minimal Client code

---

## When to Use Client Components

Use `"use client"` **only when** the component needs:

### ✅ Valid Reasons for Client Components

1. **Interactivity & State Management**

   ```jsx
   "use client";

   export function FilterWidget() {
     const [filters, setFilters] = useState({});

     return (
       <div>
         <input onChange={(e) => setFilters({...})} />
       </div>
     );
   }
   ```

2. **Event Handlers**

   ```jsx
   "use client";

   export function ClickCounter() {
     const handleClick = () => console.log("clicked");
     return <button onClick={handleClick}>Click me</button>;
   }
   ```

3. **Browser APIs**

   ```jsx
   "use client";

   export function GeolocationWidget() {
     useEffect(() => {
       navigator.geolocation.getCurrentPosition(...);
     }, []);
   }
   ```

4. **Form Validation & Real-time Updates**

   ```jsx
   "use client";

   export function SearchForm() {
     const [query, setQuery] = useState("");

     return (
       <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." />
     );
   }
   ```

5. **Context Providers**
   ```jsx
   "use client";

   export function AuthProvider({ children }) {
     const [user, setUser] = useState(null);
     return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
   }
   ```

### ❌ Invalid Reasons (Stay Server-Side)

- ❌ Just fetching data → Server Component
- ❌ Conditional rendering based on props → Server Component
- ❌ Static content → Server Component
- ❌ Passing props down → Server Component
- ❌ Simple redirects → Server Component with `redirect()`

---

## Common Patterns

### Pattern 1: Lazy-Loaded Server Content in Client Container

```jsx
// components/ServerContent.tsx (Server)
export async function ServerContent({ id }) {
  const data = await fetchData(id);
  return <div>{data.content}</div>;
}

// components/ToggleableContent.tsx (Client)
("use client");
import { useState } from "react";
import { ServerContent } from "./ServerContent";

export function ToggleableContent() {
  const [id, setId] = useState(1);

  return (
    <div>
      <button onClick={() => setId(id + 1)}>Load Next</button>
      <Suspense fallback={<p>Loading...</p>}>
        <ServerContent id={id} />
      </Suspense>
    </div>
  );
}
```

### Pattern 2: Multi-Provider Composition

```jsx
// lib/providers/Providers.tsx
"use client";

import { AuthProvider } from "./AuthProvider";
import { ThemeProvider } from "./ThemeProvider";
import { ToastProvider } from "./ToastProvider";

export function Providers({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

```jsx
// app/layout.tsx (Server)
import { Providers } from "@/lib/providers/Providers";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### Pattern 3: Isolated Interactive Island

```jsx
// components/ProductList.tsx (Server)
export async function ProductList() {
  const products = await getProducts();

  return (
    <div className="grid gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

// components/ProductCard.tsx (Server - mostly)
import { AddToCartButton } from "./AddToCartButton";

export function ProductCard({ product }) {
  return (
    <div className="border p-4">
      <h2>{product.name}</h2>
      <p>${product.price}</p>
      <AddToCartButton productId={product.id} /> {/* Small Client Island */}
    </div>
  );
}

// components/AddToCartButton.tsx (Client - small & focused)
("use client");
import { useShoppingCart } from "@/hooks/useShoppingCart";

export function AddToCartButton({ productId }) {
  const { addToCart } = useShoppingCart();

  return <button onClick={() => addToCart(productId)}>Add to Cart</button>;
}
```

---

## Server Actions for Mutations

### Core Philosophy

Server Components handle **reads**. Server Actions handle **writes**. There is no third mutation path.

- ✅ **Reads** (queries, fetches, computed data) → Server Components with `async/await`
- ✅ **Writes** (create, update, delete, any state change) → Server Actions with `"use server"`
- ❌ Never mutate data via `fetch`/`axios` from a Client Component
- ❌ Never create `app/api/` route handlers for mutations (route handlers are for webhooks and external integrations only)

A Server Action is an async function marked with the `"use server"` directive. Behind the scenes, actions use the `POST` method — only `POST` can invoke them, and Next.js encrypts the action IDs (more in Security below).

### Form Handling

All submitted-form rules live in [docs/FORM_HANDLING.md](FORM_HANDLING.md). Read it for the required `useActionState` boundary, action-state shape and constructors, validation/error handling, value retention/reset, shadcn field errors, pending submit controls, and success/error feedback callbacks.

### File Organization

Every Server Action lives in `features/<name>/actions/<verb>.ts` — **one verb per file**, with `"use server"` at the top of the file (file-level directive).

```
features/meal-log/
  actions/
    create-meal.ts    # "use server" — exports createMeal
    update-meal.ts    # "use server" — exports updateMeal
    delete-meal.ts    # "use server" — exports deleteMeal
    like-meal.ts      # "use server" — exports likeMeal
  components/
  services/
  types.ts
```

### Input Validation

Validate every Server Action input with `zod` and `safeParse`. Never trust client input; a Server Action is a public POST endpoint reachable from outside the UI.

For submitted forms, use the values-and-error result contract in [docs/FORM_HANDLING.md](FORM_HANDLING.md).

### Cache and Navigation

After a mutation, refresh cached data so the UI reflects the change. Three options are available from `next/cache`:

| Function                    | Use case                                                                                                                                                                                         | Scope                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `refresh()`                 | Refresh the current Router (re-fetch all data for the current route, re-render the current React tree). Does **not** invalidate tagged cache.                                                    | Client router only — useful when the mutation affects the current page |
| `revalidatePath(paths.x())` | Invalidate all cached data for a specific route path. Use when the mutation affects a known route.                                                                                               | The path specified — always pass path strings through `paths.ts`       |
| `revalidateTag("tag")`      | Invalidate cached entries by tag, using stale-while-revalidate semantics. The preferred approach when caching uses `cacheTag()`.                                                                 | All entries with the tag — slightly delayed refresh                    |
| `updateTag("tag")`          | Immediately expire cached entries for **read-your-own-writes** scenarios. Only works inside Server Actions (not Route Handlers). Used after a mutation so the user sees their change right away. | All entries with the tag — immediate refresh                           |

```ts
"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { logPath, mealDetailPath } from "@/paths"
import { db } from "@/lib/db"

export async function createMeal(_: MealFormState, formData: FormData) {
  // ...validate and mutate...
  const result = await db.execute({ sql: "...", args: [...] })

  revalidatePath(logPath())                 // refresh the log list cache
  redirect(mealDetailPath(String(result.lastInsertRowid)))  // throw and navigate
}
```

> **Good to know:** `revalidatePath` takes a path _string_, not a tagged component. Prefer tag-based revalidation (`revalidateTag`/`updateTag`) over path-based when the codebase uses `cacheTag()` — it's more precise and avoids over-invalidating.

**`redirect` throws and halts execution** — any code after it will not run. Call `revalidatePath` (or `updateTag`) **before** `redirect` if you need fresh data before navigating.

### Security

**Server Actions are reachable via direct POST requests.** Anyone who can guess the action ID can call it — Next.js encrypts the IDs to make this harder, but you must still verify authorization inside every action.

Mandatory for every Server Action:

1. **Verify authentication** — confirm the caller is signed in. This project uses Better Auth; call `getSession()` (or `requireUserId()`) from `@/lib/server/session` — see `src/features/marks/actions/save-marks.ts` for the pattern. Examples in this guide omit the auth check for brevity — do not ship without it.
2. **Verify authorization** — confirm the caller owns or can access the resource being mutated. Never trust a `formData.get("userId")` to identify the actor — read it from the verified session.
3. **Validate input** — `zod` `safeParse` on every field. Never pass raw `formData` directly to the database.
4. **Keep secrets server-side** — secrets, env vars, and server-only imports (`@/lib/db`) must never appear in a file without `"use server"`.

Next.js built-in protections:

- **Encrypted action IDs** — action IDs are encrypted and periodically recalculated, making them hard to guess
- **Dead-code elimination** — unused Server Actions are removed from the client bundle during `next build`, so they're not publicly reachable
- **POST only** — actions can only be invoked via `POST`, not GET

### Anti-Patterns for Server Actions

#### ❌ Don't: Mutate via `fetch` from a Client Component

```tsx
// ❌ Wrong — client-side fetch to a mutation endpoint
"use client"
export function BadForm() {
  const onSubmit = async (e) => {
    e.preventDefault()
    await fetch("/api/meals", { method: "POST", body: JSON.stringify(...) })
  }
  return <form onSubmit={onSubmit}>...</form>
}

// ✅ Correct — call the Server Action through useActionState
```

#### ❌ Don't: Create `app/api/` route handlers for mutations

```ts
// ❌ Wrong — route handler for a mutation
// app/api/meals/route.ts
export async function POST(req: Request) {
  const body = await req.json();
  // mutate...
}

// ✅ Correct — use a Server Action in features/<name>/actions/<verb>.ts
```

Route handlers are only for webhooks, OAuth callbacks, and external integrations.

#### ❌ Don't: Inline `"use server"` inside a route file

```tsx
// ❌ Wrong — inline server action in a page component (forbidden by feature-folders)
// app/(app)/log/new/page.tsx
export default function Page() {
  async function createMeal(formData: FormData) {
    "use server";
    // mutate...
  }
  return <form action={createMeal}>...</form>;
}

// ✅ Correct — action lives in features/<name>/actions/<verb>.ts and is imported
import { createMeal } from "@/features/meal-log/actions/create-meal";
```

#### ❌ Don't: Mix `"use server"` and `"use client"` in the same file

The directives are mutually exclusive — a file is either a Server Module or a Client Module. Never combine them.

#### ❌ Don't: Import server-only code from a file without `"use server"`

`@/lib/db`, env vars, and server secrets must never be imported from a Client Component or any file without the `"use server"` directive. The bundler will leak them.

---

## Anti-Patterns to Avoid

### ❌ Don't: Wrap entire page in "use client"

```jsx
"use client";

export default function Page() {
  // Everything is now a Client Component
  // No server-side data fetching
  // More JavaScript sent to browser
}
```

### ❌ Don't: Multiple nested "use client" boundaries

```jsx
"use client";
function Wrapper() {
  return <ChildComponent />;
}

// ChildComponent.tsx
"use client"; // Unnecessary, parent is already Client
function ChildComponent() { ... }
```

### ❌ Don't: Use server features in Client Components

```jsx
"use client";

export function BadComponent() {
  const data = await fetchData(); // ❌ Can't use await
  const secret = process.env.SECRET; // ❌ Exposed to browser
}
```

### ❌ Don't: Avoid composition when you should use it

```jsx
// Server Component doing too much
"use client"; // Shouldn't need this!

export function ComplexFeature() {
  const [state, setState] = useState();
  const data = await fetchData(); // Mixing concerns
  // ...
}

// ✅ Instead: Extract interactive part
// Server handles fetching, Client handles state
```

---

## File Structure Recommendation

```
src/
├── app/
│   ├── layout.tsx (Server - wraps with Providers)
│   ├── page.tsx (Server)
│   └── [id]/
│       └── page.tsx (Server)
├── components/
│   ├── server/
│   │   ├── ProductList.tsx (Server)
│   │   └── PostCard.tsx (Server)
│   ├── client/
│   │   ├── AddToCartButton.tsx (Client - focused)
│   │   └── FilterWidget.tsx (Client - focused)
│   └── providers/
│       ├── ThemeProvider.tsx (Client wrapper)
│       ├── AuthProvider.tsx (Client wrapper)
│       └── Providers.tsx (Combined providers)
└── lib/
    ├── data/ (Server-only functions)
    └── utils/ (Shared utilities)
```

---

## Migration Checklist

If you have an existing Client Component that could be Server:

- [ ] Identify interactive features (state, handlers, context)
- [ ] Extract interactive code to a separate Client Component
- [ ] Move data fetching to Server Component parent
- [ ] Pass fetched data as props to Client Component
- [ ] Use composition pattern (pass children)
- [ ] Test performance improvement
- [ ] Remove `"use client"` directive from parent

---

## References

- [Next.js Server Components Documentation](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Client Components Documentation](https://nextjs.org/docs/app/building-your-application/rendering/client-components)
- [Next.js Patterns & Best Practices](https://nextjs.org/docs/app/building-your-application/rendering#when-to-use-server-and-client-components)

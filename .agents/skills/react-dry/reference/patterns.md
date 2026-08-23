# Extraction patterns

Concrete code for each duplication type. Use the pattern that matches what is being duplicated.

## JSX const extraction

Extract inline JSX into a `const` variable when the block is complex enough to obscure the render flow, or when the same element appears multiple times in one component.

**Before** — inline JSX buries the render logic:

```tsx
export function Dashboard() {
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Today's meals</CardTitle>
          <CardDescription>
            You've consumed {totalCalories} of {targetCalories} calories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercent} />
          <div className="mt-4 grid grid-cols-3 gap-4">
            <Stat label="Protein" value={protein} unit="g" />
            <Stat label="Carbs" value={carbs} unit="g" />
            <Stat label="Fat" value={fat} unit="g" />
          </div>
        </CardContent>
      </Card>
      {/* ...more cards... */}
    </div>
  );
}
```

**After** — extracted to a const, render reads top-down:

```tsx
export function Dashboard() {
  const summaryCard = (
    <Card>
      <CardHeader>
        <CardTitle>Today's meals</CardTitle>
        <CardDescription>
          You've consumed {totalCalories} of {targetCalories} calories
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Progress value={progressPercent} />
        <div className="mt-4 grid grid-cols-3 gap-4">
          <Stat label="Protein" value={protein} unit="g" />
          <Stat label="Carbs" value={carbs} unit="g" />
          <Stat label="Fat" value={fat} unit="g" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div>
      {summaryCard}
      {/* ...more cards... */}
    </div>
  );
}
```

**When to use a const vs a Component:**

| Situation                                           | Pattern                                |
| --------------------------------------------------- | -------------------------------------- |
| Block is long but used once in this component       | `const` variable                       |
| Same JSX element repeated 2+ times in one component | `const` variable                       |
| Needs its own props, state, or hooks                | Separate component                     |
| Used across multiple components                     | Separate component                     |
| Named with a noun that describes what it _is_       | Either works — prefer `const` if local |

**Naming:** use a noun that names the thing, not the markup. `summaryCard`, not `cardBlock`. `emptyState`, not `conditionalReturn`.

**Decision points:**

- If the extracted const needs more than 3 props from the parent scope, it is a component — extract it properly with an interface.
- If the const is used once and the block is under ~10 lines, leave it inline. Extraction is for clarity, not a rule to follow blindly.
- Arrow functions (`const SummaryCard = () => (...)`) are components, not const extractions — they re-render independently and lose parent context. Use a plain `const` with JSX assigned directly.

## Component extraction

Extract identical or near-identical JSX structure into a component when three or more call sites share the same tree.

**Before** — four pages with the same layout:

```tsx
// app/log/page.tsx
export default function LogPage() {
  return (
    <div className="p-11 max-w-[1000px]">
      <h1 className="font-heading text-3xl font-semibold text-foreground mb-6">Log food</h1>
    </div>
  );
}

// app/profile/page.tsx
export default function ProfilePage() {
  return (
    <div className="p-11 max-w-[1180px]">
      <h1 className="font-heading text-3xl font-semibold text-foreground mb-7">
        Profile &amp; settings
      </h1>
    </div>
  );
}
```

**After** — extracted `PageHeader` component:

```tsx
// components/page-header.tsx
interface PageHeaderProps {
  title: string;
  maxWidth?: string;
}

export function PageHeader({ title, maxWidth = "max-w-[1180px]" }: PageHeaderProps) {
  return (
    <div className={`p-11 ${maxWidth}`}>
      <h1 className="font-heading text-3xl font-semibold text-foreground mb-6">{title}</h1>
    </div>
  );
}

// app/log/page.tsx
import { PageHeader } from "@/components/page-header";

export default function LogPage() {
  return <PageHeader title="Log food" maxWidth="max-w-[1000px]" />;
}
```

**Decision points:**

- Optional props handle the variations (`maxWidth`). If variations grow, consider whether the component is doing too much.
- The `mb-6` inconsistency is normalised — pick one value unless there is a real reason for both.

## Hook extraction

Extract repeated hook logic into a custom hook when three or more components perform the same stateful operation.

**Before** — same fetch pattern in three components:

```tsx
// components/dashboard.tsx
export function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;
  return <DashboardView data={data} />;
}

// components/summary.tsx
export function Summary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;
  return <SummaryView data={data} />;
}
```

**After** — extracted `useFetch` hook:

```tsx
// hooks/use-fetch.ts
export function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(url)
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [url]);

  return { data, loading };
}

// components/dashboard.tsx
import { useFetch } from "@/hooks/use-fetch";

export function Dashboard() {
  const { data, loading } = useFetch<Stats>("/api/stats");

  if (loading) return <Skeleton />;
  return <DashboardView data={data} />;
}
```

**Decision points:**

- The hook must be generic enough for all call sites but not so generic it becomes a kitchen-sink. If three components need the same fetch with the same error handling, extract. If each needs different error handling, defer — the hook would need so many options it loses clarity.
- Name the hook after what it returns, not what it does: `useFetch` over `useDataLoader`.

## Utility extraction

Extract shared pure functions into `lib/` when three or more components perform the same computation.

**Before** — same formatting logic in three places:

```tsx
// components/meal-card.tsx
const formatted = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
}).format(new Date(meal.date));

// components/history-list.tsx
const formatted = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
}).format(new Date(entry.date));

// components/progress-chart.tsx
const formatted = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
}).format(new Date(point.date));
```

**After** — shared utility:

```tsx
// lib/format.ts
const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

export function formatShortDate(date: Date | string): string {
  return dateFormatter.format(typeof date === "string" ? new Date(date) : date);
}

// components/meal-card.tsx
import { formatShortDate } from "@/lib/format";

const formatted = formatShortDate(meal.date);
```

**Decision points:**

- If the formatting or computation is only used in two places, defer. The `Intl` constructor is not expensive to repeat twice.
- Cache the formatter instance at module scope, not per call, for performance.

## Type extraction

Extract shared type definitions into `types/` when three or more files reference the same shape.

**Before** — same interface repeated:

```tsx
// components/meal-form.tsx
interface MealEntry {
  id: string;
  name: string;
  calories: number;
  date: string;
}

// components/meal-list.tsx
interface MealEntry {
  id: string;
  name: string;
  calories: number;
  date: string;
}

// lib/api.ts
interface MealEntry {
  id: string;
  name: string;
  calories: number;
  date: string;
}
```

**After** — single source of truth:

```tsx
// types/meal.ts
export interface MealEntry {
  id: string;
  name: string;
  calories: number;
  date: string;
}

// All files import from "@/types/meal"
```

**Decision points:**

- If the shape differs slightly between files (different optional fields, different names for the same concept), align the type first. Do not extract a type that papers over a naming or shape inconsistency.
- If a type is only used in two files, keep it in the more authoritative file and import from there.

## Composition over prop drilling

When the duplication is a wrapper component that passes the same props down three or more layers, replace prop drilling with composition.

**Before** — same props drilled through a wrapper:

```tsx
// components/layout.tsx
export function Layout({ children, user, theme, locale }) {
  return (
    <div className={theme}>
      <Sidebar user={user} locale={locale} />
      <main>{children}</main>
    </div>
  );
}

// components/sidebar.tsx
export function Sidebar({ user, locale }) {
  return (
    <nav>
      <UserMenu user={user} />
      <LocaleSwitcher locale={locale} />
    </nav>
  );
}
```

**After** — compose at the call site:

```tsx
// components/layout.tsx
export function Layout({ children }) {
  return (
    <div>
      <Sidebar />
      <main>{children}</main>
    </div>
  );
}

// app/layout.tsx — compose at the top
export default function RootLayout({ children }) {
  const user = useUser();
  const locale = useLocale();

  return (
    <Layout>
      <Sidebar user={user} locale={locale} />
      {children}
    </Layout>
  );
}
```

**Decision points:**

- Composition works when the intermediate components do not need the props themselves. If `Layout` uses `user` or `theme` directly, prop drilling or a context may still be appropriate.
- Do not extract a context just to avoid passing props through one intermediate layer. Context is for truly global data, not a shortcut for one level of indirection.

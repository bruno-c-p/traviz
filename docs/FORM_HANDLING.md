# Form Handling

This document is the source of truth for submitted forms, Server Action result state, validation errors, and pending UI.

## Standard

Every submitted form uses `useActionState` from `react`.

- Keep the form in a focused Client Component.
- Keep data reads, page layout, and composition in Server Components.
- Pass the action returned by `useActionState` to `<form action={action}>`.
- Route writes through a Server Action in `features/<name>/actions/<verb>.ts`.
- Keep custom form and submit-state components in `components/form/*`.

Each action result uses one serializable shape:

```ts
type FormActionState<T> = {
  status: "IDLE" | "SUCCESS" | "ERROR";
  message: string;
  values: T;
  fieldErrors: Record<string, string[] | undefined>;
  timestamp: number;
};
```

`values` contains submitted strings. Never put `FormData` in action state. `timestamp` changes for every result and lets client effects observe a new result without comparing message text.

Use `T` for the single generic type parameter in shared form utilities.

## Result constructors

Use `createEmptyActionState(values)` for the initial client state, `zodErrorState(values, error)` for validation failures, `unexpectedErrorState(values, error)` for unexpected failures, and `toActionState("SUCCESS", message, values)` for same-page success.

`zodErrorState` maps `error.flatten()` to field and form errors. `unexpectedErrorState` logs server-side and returns a generic message. Never expose `Error.message`, stack traces, database details, or raw `FormData` to the client.

## Server Action

The action receives `(previousState, formData)`. Map form entries to submitted strings before validation so values can be returned on failure. Use `safeParse` and return early through `zodErrorState`.

```ts
"use server";

import { z } from "zod";
import {
  unexpectedErrorState,
  toActionState,
  zodErrorState,
  type FormActionState,
} from "@/components/form/utils/to-action-state";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logPath, mealDetailPath } from "@/paths";
import { db } from "@/lib/db";

const mealSchema = z.object({
  name: z.string().min(1),
  calories: z.coerce.number().int().positive(),
});

type MealValues = {
  name: string;
  calories: string;
};

export async function createMeal(_: FormActionState<MealValues>, formData: FormData) {
  const values: MealValues = {
    name: String(formData.get("name") ?? ""),
    calories: String(formData.get("calories") ?? ""),
  };
  const parsedValues = mealSchema.safeParse(values);

  if (!parsedValues.success) {
    return zodErrorState(values, parsedValues.error);
  }

  try {
    const result = await db.execute({
      sql: "INSERT INTO meals (name, calories) VALUES (?, ?)",
      args: [parsedValues.data.name, parsedValues.data.calories],
    });
  } catch (error) {
    return unexpectedErrorState(values, error);
  }

  revalidatePath(logPath());
  redirect(mealDetailPath(String(result.lastInsertRowid)));
}
```

Use `toActionState("SUCCESS", message, values)` when a successful action stays on the same page. Redirects are successful results and do not need a manual reset.

## Shared form primitives

The action-form abstraction lives in `components/form/*`:

- `Form` renders the tracked `<form>`, sends non-empty success/error messages through the global shadcn `Toaster`, and accepts optional `onSuccess`/`onError` callbacks.
- `FieldError` maps `fieldErrors[name]` to shadcn `FieldError` objects.
- `SubmitButton` reads `pending` with `useFormStatus`, disables itself, and shows a spinner.
- `useActionFeedback` runs callbacks once for each new action-state timestamp.
- `Toaster` is mounted once in `app/layout.tsx`.

Use `Form` when the form has an action state. Keep `Field`, `FieldGroup`, and controls from `components/ui/*`:

## Client form

Use submitted values as `defaultValue`. Do not reset, remount, or change a form/control key after an error. Reset only after confirmed success; use `useActionFeedback` when a non-redirect form needs a success reset or notification.

Use shadcn `FieldGroup` and `Field` for layout. For an invalid field:

1. Set `data-invalid` on `Field`.
2. Set `aria-invalid` on the control.
3. Render `FieldError` immediately after the control.

Pass string errors as shadcn `FieldError` children. Its `errors` prop is only for objects shaped like `{ message }`; the shared `FormFieldError` adapter performs that mapping for field errors. Use shadcn `FieldError` for form-level messages too.

```tsx
"use client";

import { useActionState } from "react";
import {
  FieldError as FormFieldError,
  Form,
  SubmitButton,
  createEmptyActionState,
} from "@/components/form";
import {
  Field,
  FieldError as ShadcnFieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createMeal } from "@/features/meal-log/actions/create-meal";

type MealValues = {
  name: string;
  calories: string;
};

const initialState = createEmptyActionState<MealValues>({
  name: "",
  calories: "",
});

export function MealForm() {
  const [state, action] = useActionState(createMeal, initialState);
  const nameError = state.fieldErrors.name?.[0];
  const caloriesError = state.fieldErrors.calories?.[0];

  return (
    <Form action={action} actionState={state}>
      <FieldGroup>
        <Field data-invalid={Boolean(nameError)}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            name="name"
            defaultValue={state.values.name}
            aria-invalid={Boolean(nameError)}
          />
          <FormFieldError actionState={state} name="name" />
        </Field>
        <Field data-invalid={Boolean(caloriesError)}>
          <FieldLabel htmlFor="calories">Calories</FieldLabel>
          <Input
            id="calories"
            name="calories"
            defaultValue={state.values.calories}
            aria-invalid={Boolean(caloriesError)}
          />
          <FormFieldError actionState={state} name="calories" />
        </Field>
      </FieldGroup>
      <SubmitButton label="Log meal" />
      {state.message && <ShadcnFieldError>{state.message}</ShadcnFieldError>}
    </Form>
  );
}
```

`SubmitButton` is rendered inside the tracked form and calls `useFormStatus` from `react-dom`. It disables itself while `pending`. Never call `useFormStatus` in the component that renders the tracked `<form>`.

## Action feedback

`Form` uses `useActionFeedback` from `components/form/hooks/use-action-feedback.ts` for client-side effects that depend on a completed action. This follows the callback pattern from [the referenced form-abstraction commit](https://github.com/rwieruch/the-road-to-next-app/commit/cb6fbe1784dfc70a9fb40dd2d2a1d8bfe3846b1a).

Use the hook directly when a form needs behavior beyond the default toast:

```tsx
import { useActionFeedback } from "@/components/form";

useActionFeedback(state, {
  onSuccess: (actionState) => {
    showSavedNotice(actionState.message);
  },
  onError: (actionState) => {
    focusFirstInvalidField(actionState.fieldErrors);
  },
});
```

Use callbacks for toasts, notifications, focus management, or analytics. The initial `IDLE` state produces no callback. A success callback may reset a non-redirect form; an error callback must leave submitted values mounted and available for correction. Redirecting actions usually unmount immediately, so use this hook mainly for actions that remain on the current page.

## Checks

After form work, run `bun run lint`, `bun run format`, and, when TypeScript changes, `bun run typecheck`.

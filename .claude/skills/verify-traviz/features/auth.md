# Sign-in and sign-out

traviz signs users in with a Clerk email link only, with no passwords and no social providers. `/sign-in` takes an email address and sends a link. The link opens `/sign-in/verify`, which finishes the sign-in, and the first tab then continues on its own. Sign-out is on `/stats#account`. `src/proxy.ts` gates every route by its row in `ROUTES` in `paths.ts`.

## Sub-features

- `auth-form` sends a link from the `Email` field and the `Continue with email` button, then shows `We sent a sign-in link to <email>` and a `Use a different email` button.
- `auth-error` shows an alert under the field when Clerk rejects the address.
- `auth-verify` shows `Checking your link…`, then `You're signed in`, or `This link has expired`, `We couldn't verify this link` or `Open the link on the same device`, each with a `Get a new link` link.
- `auth-signout` signs out from the `Sign out` button in the `Account` section and lands on `/sign-in`.
- `auth-gate` redirects by route access: `signedIn` routes send a signed-out user to `/sign-in`, `signedOut` routes send a signed-in user to `/`, and `anyone` routes let both through.

## How to get to it (user POV)

- Open any app route while signed out, or open `/sign-in`.
- Open the link from the email, which goes to `/sign-in/verify`.
- Choose the `Account` link (top right on `/`, it opens `/stats#account`), then choose `Sign out`.

## Driving it with playwright-core

Preconditions:

- Baseline from the README. The route table on main is `/` signedIn, `/list` signedIn, `/stats` signedIn, `/sign-in` signedOut and `/sign-in/verify` anyone. Read `ROUTES` in `paths.ts` before you assert, because it is the source.

- **Gate, signed out.** Run `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:<port>/list`. It prints `307 http://localhost:<port>/sign-in`. `/`, `/stats` and an unknown path such as `/nope` print the same, because a path with no row counts as `signedIn`. `/sign-in` and `/sign-in/verify` print `200`.
- **Gate, signed in.** After `signIn(page, baseUrl)`, run `page.goto(baseUrl + "/sign-in")`. The page ends on `/`.
- **Form.** In a fresh context, open `/sign-in` and wait for `window.Clerk?.loaded`. Fill `page.getByRole("textbox", { name: "Email" })` with `verify-<Date.now()>+clerk_test@example.com` and click `Continue with email`. The button reads `Sending link…` for about 4 s, so `settle` is too short. Wait for the text instead, with `page.getByText("We sent a sign-in link to").waitFor({ timeout: 20_000 })`. The address appears with it. `Use a different email` brings the form back with the address still filled in.
- **Verify page.** Open `/sign-in/verify` with no link parameters. After Clerk loads, the heading reads `We couldn't verify this link` and a `Get a new link` link points to `/sign-in`.
- **Sign out.** Signed in, open `/stats#account`. The section shows `agent+clerk_test@example.com`. Click `Sign out`. The button reads `Signing out…`, then the page lands on `/sign-in`. `localStorage.getItem("traviz-marks-v2")` is `null` there, because sign-out clears the marks cache once Clerk's sign-out resolves.
- **Ticket sign-in.** `signIn` in `@/shared/testing/verify/browser` signs in without email. Use it for every journey that only needs a session.

## Gotchas

- A new address logs one expected `http 422` from Clerk's `/v1/client/sign_ins` in `problems`, because no user has that address yet, and the form then sends a sign-up link. Any other Clerk error counts.
- Clerk development returns 429 when one address submits twice in a short time. Use a new `+clerk_test` address for every submit.
- A `+clerk_test` address never receives mail, so the full link click cannot run here. A complete email round trip needs a real inbox on the dev instance, and none is set up. Report the link click as not verified instead of faking it.
- `prefetchUI={false}` is set on the `ClerkProvider` in `src/app/sign-in/layout.tsx`, so Clerk's prebuilt UI never loads. The `(app)` routes have no `ClerkProvider`. They add `clerk.browser.js` themselves after the window `load` event, so `window.Clerk` is undefined there for the first moments of a hard load. The form is traviz's own code in `src/features/auth`.
- `curl` sees only the proxy's redirect. A page-level redirect after Clerk loads needs the browser.
- The sign-in pages no longer clear any marks storage. The marks cache is tagged with its owner, and a cached owner shows only when Clerk's `__session` cookie names the same user, so one user's cached marks never show for another. See [marks.md](marks.md).

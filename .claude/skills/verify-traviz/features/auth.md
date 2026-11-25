# Sign-in and sign-out

traviz signs users in with a Clerk email link only, with no passwords and no social providers. `/sign-in` takes an email address and sends a link. The link opens `/sign-in/verify`, which finishes the sign-in, and the first tab then continues on its own. Sign-out is in the account menu (the `Account and theme` button, top right on every page at 768 px and up, and inside the globe view and the stats view below that. `/list` has no button below 768 px). `src/middleware.ts` gates every route by its row in `ROUTES` in `paths.ts`. Re-check every name in this file against the pages under `src/pages/sign-in` and the account menu in `src/features/auth` after a change there.

## Sub-features

- `auth-form` sends a link from the `Email` field and the `Continue with email` button, then shows `We sent a sign-in link to <email>` and a `Use a different email` button.
- `auth-error` shows an alert under the field when Clerk rejects the address.
- `auth-verify` shows `Checking your link…`, then `You're signed in`, or `This link has expired`, `We couldn't verify this link` or `Open the link on the same device`, each with a `Get a new link` link.
- `auth-signout` signs out from the `Sign out` button in the account menu and lands on `/sign-in`.
- `auth-gate` redirects by route access: `signedIn` routes send a signed-out user to `/sign-in`, `signedOut` routes send a signed-in user to `/`, and `anyone` routes let both through.

## How to get to it (user POV)

- Open any app route while signed out, or open `/sign-in`.
- Open the link from the email, which goes to `/sign-in/verify`.
- Choose the `Account and theme` button (top right), which opens the `Account` dialog, then choose `Sign out`. The same dialog holds the `Theme` radio group (`System`, `Light`, `Dark`) and the danger zone. `Escape`, the `Close` button or a click outside closes it.

## Driving it with playwright-core

Preconditions:

- Baseline from the README. The route table on main is `/` signedIn, `/list` signedIn, `/stats` signedIn, `/sign-in` signedOut and `/sign-in/verify` anyone. Read `ROUTES` in `paths.ts` before you assert, because it is the source.

- **Gate, signed out.** Run `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:<port>/list`. It prints `307 http://localhost:<port>/sign-in`. `/`, `/stats` and an unknown path such as `/nope` print the same, because a path with no row counts as `signedIn`. `/sign-in` and `/sign-in/verify` print `200`.
- **Gate, signed in.** After `signIn(page, baseUrl)`, run `page.goto(baseUrl + "/sign-in")`. The page ends on `/`.
- **Form.** In a fresh context, open `/sign-in` and wait for `window.Clerk?.loaded`. Fill `page.getByRole("textbox", { name: "Email" })` with `verify-<Date.now()>+clerk_test@example.com` and click `Continue with email`. The button reads `Sending link…` for about 4 s, so `settle` is too short. Wait for the text instead, with `page.getByText("We sent a sign-in link to").waitFor({ timeout: 20_000 })`. The address appears with it. `Use a different email` brings the form back with the address still filled in.
- **Verify page.** Open `/sign-in/verify` with no link parameters. After Clerk loads, the heading reads `We couldn't verify this link` and a `Get a new link` link points to `/sign-in`.
- **Sign out.** Signed in, click the visible `Account and theme` button (`/` renders two, one per breakpoint, so filter with `visible=true`). The `Account` dialog shows `agent+clerk_test@example.com`. Click `Sign out`. The button reads `Signing out…`, then the page lands on `/sign-in`, and `/list` then redirects there too. The alert `Couldn't sign out. Check your connection and try again.` shows, with the button back to `Sign out`, only when clerk-js cannot load (block `**/clerk.browser.js*` before the page loads it, and expect about 20 s of retries) or when its `signOut` rejects. Once clerk-js has loaded, a failed sign-out request (abort `clerk.accounts.dev/v1/` with `context.route`) does not reject: clerk-js still navigates to `/sign-in`, the server finds the session alive and redirects to `/`, and no alert shows.
- **Ticket sign-in.** `signIn` in `@/shared/testing/verify/browser` signs in without email. Use it for every journey that only needs a session.

## Gotchas

- A new address logs one expected `http 422` from Clerk's `/v1/client/sign_ins` in `problems`, because no user has that address yet, and the form then sends a sign-up link. Any other Clerk error counts.
- Clerk development returns 429 when one address submits twice in a short time. Use a new `+clerk_test` address for every submit.
- A `+clerk_test` address never receives mail, so the full link click cannot run here. A complete email round trip needs a real inbox on the dev instance, and none is set up. Report the link click as not verified instead of faking it.
- No page loads Clerk's prebuilt UI. The form is traviz's own code in `src/features/auth`. `/sign-in` and `/sign-in/verify` add `clerk.browser.js` as soon as they are parsed, from a script inlined in the page, and request no other JS. The app pages add it after the window `load` event, so `window.Clerk` is undefined there for the first moments of a hard load.
- The account menu is not in the page until the button is hovered, focused or clicked. It arrives as one request, `/fragments/account-menu`, with its script and styles inside, and the `dialog` is appended to `<body>`. The email in it is empty until clerk-js has loaded, so wait for `[data-account-email]` to have text.
- Clerk Protect probes odd ports (`:18443`, `:2082`, `:8443`, `:992`) from the sign-in pages. In a sandbox that blocks them, `problems` gains `Failed to load resource: net::ERR_CONNECTION_RESET` lines, which are not the app's. `signIn` from the verify helpers waits 5 s for `window.Clerk` on `/sign-in` and loads clerk-js itself when the page has not.
- `curl` sees only the middleware's redirect. `/welcome` is prerendered, so the middleware never runs for it: a signed-in visitor leaves it through an inline script that reads Clerk's `__client_uat` cookie, which needs the browser.
- No page keeps marks in browser storage. Every page carries its user's marks in its own HTML, so one user's marks never show for another. See [marks.md](marks.md).

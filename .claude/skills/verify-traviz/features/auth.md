# Sign-in and sign-out

traviz signs users in with an email and a password through Clerk, with no email links and no social providers. `/sign-in` is one form for signing in and signing up, in three steps on the same page: the credentials, a 6-digit code from an email, and a new password. Sign-out is in the account menu (the `Account and theme` button, top right on every page at 768 px and up, and inside the globe view and the stats view below that. `/list` has no button below 768 px). `src/middleware.ts` gates every route by its row in `ROUTES` in `paths.ts`. Re-check every name in this file against the page under `src/pages/sign-in` and the account menu in `src/features/auth` after a change there.

## Sub-features

- `auth-form` takes the `Email` and `Password` fields and the `Continue` button. An email Clerk does not know creates the account. `Forgot password?` starts a reset for the email in the field.
- `auth-code` shows `We sent a 6-digit code to <email>. Enter it to <reason>.`, the `Code` field, `Verify code`, `Send a new code` and `Use a different email`. The reason is one of `finish creating your account`, `confirm it's you on this device`, `reset your password` or `set a password for your account, which has none yet`.
- `auth-new-password` shows the `New password` field, `Save password and sign in` and `Start over`.
- `auth-error` shows an alert under the fields of the step on screen, and the field at fault takes `aria-invalid`.
- `auth-signout` signs out from the `Sign out` button in the account menu and lands on `/sign-in`.
- `auth-gate` redirects by route access: `signedIn` routes send a signed-out user to `/sign-in`, `signedOut` routes send a signed-in user to `/`, and `anyone` routes let both through.

## How to get to it (user POV)

- Open any app route while signed out, or open `/sign-in`.
- Choose the `Account and theme` button (top right), which opens the `Account` dialog, then choose `Sign out`. The same dialog holds the `Theme` radio group (`System`, `Light`, `Dark`) and the danger zone. `Escape`, the `Close` button or a click outside closes it.

## Driving it with playwright-core

Preconditions:

- Baseline from the README. The route table on main is `/` signedIn, `/list` signedIn, `/stats` signedIn, and `/sign-in` signedOut. Read `ROUTES` in `paths.ts` before you assert, because it is the source.

- **Gate, signed out.** Run `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:<port>/list`. It prints `307 http://localhost:<port>/sign-in`. `/`, `/stats` and an unknown path such as `/nope` print the same, because a path with no row counts as `signedIn`. `/sign-in` prints `200`.
- **Gate, signed in.** After `signIn(page, baseUrl)`, run `page.goto(baseUrl + "/sign-in")`. The page ends on `/`.
- **Form.** In a fresh context, open `/sign-in` and wait for `window.Clerk?.loaded`. Fill `page.getByLabel("Email")` and `page.getByLabel("Password", { exact: true })` and click `Continue`. The button reads `One moment…` and every control is disabled until Clerk answers, so wait for the step you expect, such as `page.locator("form[data-sign-in-step=code]:not([hidden])")`, and not with `settle`. A wrong password shows `That password is incorrect. Try again, or reset it.`. On the development instance a `+clerk_test` address takes the code `424242`.
- **New device.** A password sign-in in a fresh context is a new device, so the code step follows with the reason `confirm it's you on this device`. After `424242` the page goes to `/`.
- **Reset.** Fill `Email`, click `Forgot password?`, enter `424242`, then a new password of 15 characters or more and click `Save password and sign in`. The page goes to `/`. An account with no password reaches the same code step from `Continue`. Never reset the password of `agent+clerk_test@example.com` in a journey that another worktree may be running.
- **Sign out.** Signed in, click the visible `Account and theme` button (`/` renders two, one per breakpoint, so filter with `visible=true`). The `Account` dialog shows `agent+clerk_test@example.com`. Click `Sign out`. The button reads `Signing out…`, then the page lands on `/sign-in`, and `/list` then redirects there too. The alert `Couldn't sign out. Check your connection and try again.` shows, with the button back to `Sign out`, only when clerk-js cannot load (block `**/clerk.browser.js*` before the page loads it, and expect about 20 s of retries) or when its `signOut` rejects. Once clerk-js has loaded, a failed sign-out request (abort `clerk.accounts.dev/v1/` with `context.route`) does not reject: clerk-js still navigates to `/sign-in`, the server finds the session alive and redirects to `/`, and no alert shows.
- **Ticket sign-in.** `signIn` in `@/shared/testing/verify/browser` signs in without email. Use it for every journey that only needs a session.

## Gotchas

- A new address logs one expected `http 422` from Clerk's `/v1/client/sign_ins` in `problems`, because no user has that address yet, and the form then signs it up. A wrong password or a wrong code logs a `422` too, and an account with no password logs a `400`. Any other Clerk error counts.
- Clerk challenges a sign-up from a data center address or a headless browser, and the form then shows `We couldn't confirm this sign-up. Turn off any VPN or proxy and try again.` and sends no code. A sign-up cannot be completed from such a machine, so report it as not verified. Signing in and resetting are never challenged.
- Clerk development returns 429 when one address submits several times in a short time. Use a new `+clerk_test` address for every sign-up, and wait a minute after a 429.
- A `+clerk_test` address never receives mail. Its code is always `424242` on the development instance.
- No page loads Clerk's prebuilt UI. The form is traviz's own code in `src/features/auth`. `/sign-in` adds `clerk.browser.js` as soon as it is parsed, from a script inlined in the page, and requests no other JS. The app pages add it after the window `load` event, so `window.Clerk` is undefined there for the first moments of a hard load.
- The account menu is not in the page until the button is hovered, focused or clicked. It arrives as one request, `/fragments/account-menu`, with its script and styles inside, and the `dialog` is appended to `<body>`. The email in it is empty until clerk-js has loaded, so wait for `[data-account-email]` to have text.
- Clerk Protect probes odd ports (`:18443`, `:2082`, `:8443`, `:992`) from the sign-in page. In a sandbox that blocks them, `problems` gains `Failed to load resource: net::ERR_CONNECTION_RESET` lines, which are not the app's. `signIn` from the verify helpers waits 5 s for `window.Clerk` on `/sign-in` and loads clerk-js itself when the page has not.
- `curl` sees only the middleware's redirect. `/welcome` is prerendered, so the middleware never runs for it: a signed-in visitor leaves it through an inline script that reads Clerk's `__client_uat` cookie, which needs the browser.
- No page keeps marks in browser storage. Every page carries its user's marks in its own HTML, so one user's marks never show for another. See [marks.md](marks.md).

# Landing page

The `/welcome` page, titled `Traviz: keep count of the countries you’ve seen`, is what a signed-out visitor sees. Its hero lists all 195 sovereign countries as buttons beside a spinning globe, with a labeled sample of marks. Picking a name cycles it through Visited, Want to go and Not interested, and the globe, the counts and the continent squares follow. Nothing is saved.

## Sub-features

- `landing-wall` is the group `All 195 countries`. Each name is a button whose accessible name is the country, followed by `, Visited`, `, Want to go` or `, Not interested` when marked. Only one name is in the tab order. Arrow keys, Home and End move between names.
- `landing-globe` is a canvas inside an `aria-hidden` container. It spins, and flies to each picked country. It takes no input.
- `landing-tally` shows `<n> / 195 visited`, a key with the three counts and a `Clear sample` button, which reads `Clear all` after the first pick. At 1440 px it sits under the globe. Below 1024 px it is a bar pinned to the bottom of the hero that also shows the last pick. A polite live region announces `<n> of 195 visited, <n> want to go, <n> not interested.`
- `landing-continents` shows one row per continent under `Where the count stands`, with `<n> of <total> visited` and one square per country.
- `landing-views` shows Globe, List and Stats rows. The Globe row has five island buttons (Maldives, Nauru, Palau, Tonga, Tuvalu) that pick like the wall.
- `not-found` is the root 404, `Not on the map.`, with a `Back to Traviz` link to `/`.

## How to get to it (user POV)

- Open `/` signed out. The proxy redirects to `/welcome`.
- Signed in, `/welcome` redirects to `/`.
- `Sign in` in the header and both `Start your map` links go to `/sign-in`.

## Driving it with playwright-core

Preconditions:

- A server from `bun run verify:server start`. The page needs no sign-in, so use `openPage` without `signIn`.

- **Sample.** `page.getByRole("button", { name: "France, Visited" })` exists on load, and the live region reads `12 of 195 visited, 5 want to go, 0 not interested.`
- **Pick.** Click `page.getByRole("group", { name: "All 195 countries" }).getByRole("button", { name: /^Brazil/ })` and `settle`. Its name becomes `Brazil, Visited` and the live region reads `13 of 195 visited`. Click it again for `Brazil, Want to go`.
- **Clear.** Click `Clear sample`. Every name loses its state and the live region reads `0 of 195 visited, 0 want to go, 0 not interested.`
- **Keyboard.** Focus the first name with Tab, press ArrowDown, and check that `document.activeElement` is a name on the next line.

## Gotchas

- `Tuvalu` and the other four islands have two buttons each, one in the wall and one in the Globe row. Scope locators to the `All 195 countries` group.
- The globe spins unless motion is reduced, so screenshot with `prefers-reduced-motion: reduce` for pixel diffs.
- An unknown path signed out redirects to `/sign-in`, because the gate treats it as `signedIn`. The 404 page shows only to a signed-in user.

# Globe

The `/` page shows a canvas globe that spins until the user touches it. The user picks a country by clicking it or by searching for it, which flies the camera to the country and opens its card (a side card on wide screens, a bottom sheet on narrow ones). Countries are filled in their mark colour. Only `/` loads the globe engine and its outlines.

## Sub-features

- `globe-spin` turns the globe on its own, and stops when the user presses, drags, scrolls or zooms. It never spins under reduced motion.
- `globe-click` selects the country under the pointer and opens its card.
- `globe-search` finds a country in the "Find a country" combobox and flies to it.
- `globe-card` shows the country heading, a Close button and the mark choices. Escape closes it.
- `globe-sheet` shows the same content as a dialog at the bottom on narrow screens.
- `globe-zoom` changes the zoom by one level per button press or double click, and smoothly by wheel or pinch, between 1 and 5.
- `globe-keys` lets the focused globe (a `region` named `Globe`, the first Tab stop) pan 100 px per arrow key and zoom one level per `+`, `=` or `-`. Any key it handles stops the spin. The focus ring is a 2 px ink outline inset 4 px from the canvas edge.
- `globe-markers` draws a dot at the dataset centre of every country with no outline, or with an outline under 8 px across at the current zoom (the square root of its area times the scale), in its mark colour with a white ring, and with an ink ring when selected. Its label moves below the dot. A tap within 12 px of a dot picks the nearest one before the outline under it.
- `globe-return` keeps the camera when the user leaves `/` and comes back, and spins again only if it spun before.

## How to get to it (user POV)

- Open `/` signed in, or choose the `Globe` link in the `Main` navigation.
- Click a country on the globe.
- Type in the `Find a country` combobox and choose an option.
- Press `Zoom in` or `Zoom out` in the `Zoom` group.
- Press Tab until the `Globe` region has focus, then use the arrow keys, `+` and `-`.

## Driving it with playwright-core

Preconditions:

- Baseline from the README.
- `openRoute(page, baseUrl, homePath())` waits for the map. After an in-app navigation back to `/` (a `Globe` link click), wait yourself with ``page.waitForFunction(`${findMapExpression}?.isLoaded() === true`)``.

- **Spin.** Open `/` with motion `"no-preference"`. Read `readCamera(page)` twice, 2 s apart. `lng` changes. With motion `"reduce"` it does not change.
- **Search.** Run `page.getByRole("combobox", { name: "Find a country" }).fill("Japan")`, then `settle`, then click `page.getByRole("option", { name: /Japan/ })`. After about 3.5 s, `readCamera` reads lng 138, lat 36, zoom 3, `moving: false`. A group named `Mark Japan` is visible.
- **Click.** Project a point inside the country, then click it. Take the centre from the dataset: `const center = COUNTRIES_BY_CODE.get("FRA")?.center` (from `@/features/countries`). In `page.evaluate`: `const map = ${findMapExpression}; map.jumpTo({ center, zoom: 4 }); const p = map.project(center); const box = map.getContainer().getBoundingClientRect();`. Wait 1.5 s and run `page.mouse.click(box.left + p.x, box.top + p.y)`. A group named `Mark France` appears.
- **Card.** In the `Globe details` aside, the card has the country name as its heading, a `Close` button, the `Mark <country>` group with the buttons `Visited`, `Want to go` and `Not interested`, and a `Clear mark` button once the country has a mark. Pressing `Escape` closes it, and the hint returns. The hint is `page.getByLabel("How to mark countries")`, an accessible name only. Its visible heading is `Pick a country`.
- **Sheet.** At width 375, the same selection opens a `dialog` named after the country (`page.getByRole("dialog", { name: "Japan" })`), with a `Close` button, the same mark group and a `Clear mark` button once the country has a mark.
- **Zoom.** Click `page.getByRole("button", { name: "Zoom in" })`. `(await readCamera(page))?.zoom` goes up by 1.
- **Keys.** Press Tab until `document.activeElement` has `aria-label="Globe"`, then press `ArrowRight` and `settle`. `readCamera` reads a larger `lng`, and the spin has stopped. `+` adds one zoom level after `settle`. Keys typed in the `Find a country` combobox leave the camera alone.
- **Markers.** Use `map.jumpTo({ center, zoom: 3 })` with the dataset centre of `TUV`, `GIB` or `MCO`, then `map.project(center)`. Read the canvas pixel there with `getContext("2d").getImageData`, scaled by `canvas.width / canvas.clientWidth`. It is the mark colour from `STATE_COLORS` in `@/features/marks/colors`, and 4.75 px to the right it is white. Click within 12 px of the point, and the `Mark <country>` group appears.
- **Return, camera.** Open `/` with motion `"reduce"`, so the globe does not spin. Move the camera where no selection would fly to, with ``page.evaluate(`${findMapExpression}.jumpTo({ center: [-45, 7], zoom: 1.9 })`)``. Read `readCamera`, click the `List` link, then the `Globe` link, and wait for `isLoaded()`. `readCamera` reads the same centre and zoom. On `/list` and `/stats`, `document.querySelector("[data-globe]")` is `null`.
- **Return, spin.** Open `/` with motion `"no-preference"`. Leave for `/list` and come back without touching the globe, and `lng` still changes. After a drag stops the spin, the globe stays stopped after the return.
- **Script.** `bun run verify:globe-search [--code JPN --click FRA]` runs spin, search, card, click and zoom, and writes screenshots and `journal.json`.

## Gotchas

- Always read the map through `findMapExpression`. `window.map` does not exist, and React renders no map content.
- `readCamera` returns `null` until the globe chunks have loaded. Wait for `isLoaded()`.
- Countries are filled and hit-tested from `src/features/globe/country-topology.generated.ts`, keyed by the dataset code, so Kosovo is `UNK` everywhere. Gibraltar, Tokelau, Tuvalu, Bouvet Island and the US Minor Outlying Islands have no outline, and about 60 more small countries, such as Monaco, Singapore and Malta, have outlines with no area. All of them show a marker at every zoom, so click the marker. `src/features/globe/globe-markers.test.ts` pins the codes with no outline.
- Import `STATE_COLORS` from `@/features/marks/colors` in a journey script. `@/features/marks` pulls in a `server-only` module.
- The sheet's mark buttons have no `aria-label`, so their names include the hint, such as `Visited Been there`. Match them with `{ name: /^Visited/ }`. The wide card's buttons are named exactly `Visited`, `Want to go` and `Not interested`.
- To test a search made before the globe loads, hold the globe chunks with CDP `Fetch` (see the skill's rules), pick the country, release the chunks, and check that the globe flies once it mounts.
- A touch tap selects through the canvas `pointerup`, and the canvas cancels `touchend` so the browser's follow-up click cannot land on the sheet's backdrop and close it.

# Globe

The `/` page shows a Mapbox globe that spins until the user touches it. The user picks a country by clicking it or by searching for it, which flies the camera to the country and opens its card (a side card on wide screens, a bottom sheet on narrow ones). Countries are filled in their mark colour. Only `/` loads `mapbox-gl`.

## Sub-features

- `globe-spin` turns the globe on its own, and stops when the user drags or zooms. It never spins under reduced motion.
- `globe-click` selects the country under the pointer and opens its card.
- `globe-search` finds a country in the "Find a country" combobox and flies to it.
- `globe-card` shows the country heading, a Close button and the mark choices. Escape closes it.
- `globe-sheet` shows the same content as a dialog at the bottom on narrow screens.
- `globe-zoom` changes the zoom by one level per button press.
- `globe-return` keeps the camera when the user leaves `/` and comes back, and spins again only if it spun before.

## How to get to it (user POV)

- Open `/` signed in, or choose the `Globe` link in the `Main` navigation.
- Click a country on the globe.
- Type in the `Find a country` combobox and choose an option.
- Press `Zoom in` or `Zoom out` in the `Zoom` group.

## Driving it with playwright-core

Preconditions:

- Baseline from the README. The `.env.local` has a Mapbox token (the doctor checks it). Without one the globe is a flat placeholder.
- Wait for the map before you read it: `page.waitForFunction(\`${findMapExpression}?.isStyleLoaded() === true\`)`.

- **Spin.** Open `/` with motion `"no-preference"`. Read `readCamera(page)` twice, 2 s apart. `lng` changes. With motion `"reduce"` it does not change.
- **Search.** Run `page.getByRole("combobox", { name: "Find a country" }).fill("Japan")`, then `settle`, then click `page.getByRole("option", { name: /Japan/ })`. After about 3.5 s, `readCamera` reads lng 138, lat 36, zoom 3, `moving: false`. A group named `Mark Japan` is visible.
- **Click.** Project a point inside the country, then click it. Take the centre from the dataset: `const center = COUNTRIES_BY_CODE.get("FRA")?.center` (from `@/features/countries`). In `page.evaluate`: `const map = ${findMapExpression}; map.jumpTo({ center, zoom: 4 }); const p = map.project(center); const box = map.getContainer().getBoundingClientRect();`. Wait 1.5 s and run `page.mouse.click(box.left + p.x, box.top + p.y)`. A group named `Mark France` appears.
- **Card.** In the `Globe details` aside, the card has the country name as its heading, a `Close` button, the `Mark <country>` group with the buttons `Visited`, `Want to go` and `Not interested`, and a `Clear mark` button once the country has a mark. Pressing `Escape` closes it, and the `How to mark countries` hint returns.
- **Sheet.** At width 375, the same selection opens a `dialog` named after the country (`page.getByRole("dialog", { name: "Japan" })`), with a `Close` button, the same mark group and a `Clear mark` button once the country has a mark.
- **Zoom.** Click `page.getByRole("button", { name: "Zoom in" })`. `(await readCamera(page))?.zoom` goes up by 1.
- **Return.** With motion `"reduce"` (or after a drag stops the spin), click the `List` link, then the `Globe` link. `readCamera` reads the same centre and zoom as before you left. A globe that was spinning keeps spinning, so its centre moves. On `/list` and `/stats`, `document.querySelector(".mapboxgl-map")` is `null`.
- **Script.** `bun run verify:globe-search [--code JPN --click FRA]` runs spin, search, card, click and zoom, and writes screenshots and `journal.json`.

## Gotchas

- Always read the map through `findMapExpression`. `window.map` does not exist, and React renders no map content.
- `readCamera` returns `null` until `mapbox-gl` has loaded, and for the first moments `styleLoaded` is `false`. Wait for `isStyleLoaded()`.
- Countries are filled by the `iso_3166_1_alpha_3` code in the `country-boundaries-v1` tileset. Kosovo is `XKS` in the tileset and `UNK` in the dataset, and `src/features/globe/tileset-feature.ts` maps it. To test another code that differs, read `map.queryRenderedFeatures(point)` at the clicked point.
- The sheet's mark buttons have no `aria-label`, so their names include the hint, such as `Visited Been there`. Match them with `{ name: /^Visited/ }`. The wide card's buttons are named exactly `Visited`, `Want to go` and `Not interested`.
- Mapbox answers 404 for tiles with no land. `openPage` leaves those out of `problems`. Any other Mapbox error counts.
- Under software WebGL the first frame can take several seconds. Wait for `isStyleLoaded()`, never a fixed short delay.
- To test a search made before the style loads, hold the `mapbox-gl` chunk with CDP `Fetch` (see the skill's rules), pick the country, release the chunk, and check that the globe flies once it loads.

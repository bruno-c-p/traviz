# Globe

The `/` page shows a canvas globe that spins until the user touches it. The user picks a country by clicking it or by searching for it, which flies the camera to the country and opens its card (a side card on wide screens, a bottom sheet on narrow ones). Countries are filled in their mark colour. A direct load of `/list` or `/stats` does not load the globe engine and its outlines: they load when the Globe tab is first opened there. Re-check every name and step in this file against `src/features/globe` after a change to the globe view.

## Sub-features

- `globe-spin` turns the globe on its own, and stops when the user presses, drags, scrolls or zooms. It never spins under reduced motion.
- `globe-click` selects the country under the pointer and opens its card.
- `globe-search` finds a country in the "Find a country" combobox and flies to it.
- `globe-card` shows the country heading, a Close button and the mark choices. Escape closes it.
- `globe-sheet` shows the same content as a dialog at the bottom on narrow screens.
- `globe-zoom` changes the zoom by one level per button press or double click, and smoothly by wheel or pinch, between 1 and 5.
- `globe-keys` lets the focused globe (a `region` named `Globe`, the first Tab stop) pan 100 px per arrow key and zoom one level per `+`, `=` or `-`. Any key it handles stops the spin. The focus ring is a 2 px ink outline inset 4 px from the canvas edge.
- `globe-markers` draws a dot at the dataset centre of every country with no outline, or with an outline under 8 px across at the current zoom (the square root of its area times the scale), in its mark colour with a white ring, and with an ink ring when selected. Its label moves below the dot. A tap within 12 px of a dot picks the nearest one before the outline under it.
- `globe-return` keeps the camera when the user leaves `/` and comes back, and spins again only if it spun before. The globe stays mounted while another tab shows, with its spin and its store sync paused.
- `globe-account-change` clears the selection, returns the mounted globe to the default camera and lets it spin again when the marks owner changes from one account to another or to none.

## How to get to it (user POV)

- Open `/` signed in, or choose the `Globe` link in the `Main` navigation.
- Click a country on the globe.
- Type in the `Find a country` combobox and choose an option.
- Press `Zoom in` or `Zoom out` in the `Zoom` group.
- Press Tab until the `Globe` region has focus, then use the arrow keys, `+` and `-`.

## Driving it with playwright-core

Preconditions:

- Baseline from the README.
- `openRoute(page, baseUrl, homePath())` waits until the canvas inside `[data-globe-host]` has a drawn pixel at its centre. The camera is not readable from the page. `readGlobeSignature(page)` samples a 48 by 48 grid of the canvas and returns `{ signature, opaque }`, or `null` when there is no canvas: compare two signatures to see whether the globe moved, and `opaque`, the count of drawn sample points, to see whether it grew.

- **Spin.** Open `/` with motion `"no-preference"`. Read `readGlobeSignature(page)` twice, 2 s apart. The signatures differ. With motion `"reduce"` they are equal.
- **Search.** Run `page.getByRole("combobox", { name: "Find a country" }).fill("Japan")`, then `settle`, then click `page.getByRole("option", { name: /Japan/ })`. After about 3.5 s the signature differs from the one before the search and no longer changes, and a group named `Mark Japan` is visible. A screenshot shows Japan at the centre.
- **Click.** Fly to the country with the search, press `Escape` to close its card, then click the centre of the canvas (`page.locator(globeCanvasSelector).boundingBox()`), where the fly left the country. A group named `Mark France` appears.
- **Card.** In the `Globe details` aside, the card has the country name as its heading, a `Close` button, the `Mark <country>` group with the buttons `Visited`, `Want to go` and `Not interested`, and a `Clear mark` button once the country has a mark. Pressing `Escape` closes it, and the hint returns. The hint is `page.getByLabel("How to mark countries")`, an accessible name only. Its visible heading is `Pick a country`.
- **Sheet.** At width 375, the same selection opens a `dialog` named after the country (`page.getByRole("dialog", { name: "Japan" })`), with a `Close` button, the same mark group and a `Clear mark` button once the country has a mark.
- **Zoom.** Click `page.getByRole("button", { name: "Zoom in" })` and wait about 1.2 s. The signature changes. `opaque` does not fall, but it proves little: at 1440 px the canvas is painted edge to edge, so every sample point is drawn before and after. Look at the screenshot to confirm the globe is larger.
- **Keys.** Press Tab until `document.activeElement` has `aria-label="Globe"`, then press `ArrowRight` and `settle`. The signature changes once and then holds, because the spin has stopped. `+` changes it again after `settle`. Keys typed in the `Find a country` combobox leave the globe alone.
- **Markers.** Search for `Tuvalu`, `Gibraltar` or `Monaco`, so the fly leaves its marker at the centre of the canvas. Read the canvas pixel there with `getContext("2d").getImageData`, scaled by `canvas.width / canvas.clientWidth`. It is the mark colour from `STATE_COLORS` in `@/features/marks/colors`. Press `Escape`, click within 12 px of the centre, and the `Mark <country>` group appears.
- **Return, camera.** Open `/` with motion `"reduce"`, so the globe does not spin. Search for a country, press `Escape`, and read the signature. Click the `List` link, then the `Globe` link, and `settle`. The signature is the same. The views share one document, so after the switch the globe host is still in the DOM, hidden with the `view-inactive` class.
- **Return, spin.** Open `/` with motion `"no-preference"`. Leave for `/list` and come back without touching the globe, and the signature still changes. After a drag stops the spin, the globe stays stopped after the return.
- **Script.** `bun run verify:globe-search [--code JPN --click FRA]` runs spin, search, card, click and zoom, and writes screenshots and `journal.json`.

## Gotchas

- The page exposes no globe object. Read the globe from its canvas pixels (`readGlobeSignature`) and from the DOM around it.
- `readGlobeSignature` returns `null` until the canvas is in the document. `openRoute` waits for the first drawn pixel on a direct load of `/`. After a tab switch to the globe, poll it yourself.
- Countries are filled and hit-tested from `src/features/globe/country-topology.generated.ts`, keyed by the dataset code, so Kosovo is `UNK` everywhere. Gibraltar, Tokelau, Tuvalu, Bouvet Island and the US Minor Outlying Islands have no outline, and about 60 more small countries, such as Monaco, Singapore and Malta, have outlines with no area. All of them show a marker at every zoom, so click the marker. `src/features/globe/globe-markers.test.ts` pins the codes with no outline.
- Import `STATE_COLORS` from `@/features/marks/colors` in a journey script. `@/features/marks` starts the browser store, which a script has no use for.
- The sheet's mark buttons have no `aria-label`, so their names include the hint, such as `Visited Been there`. Match them with `{ name: /^Visited/ }`. The wide card's buttons are named exactly `Visited`, `Want to go` and `Not interested`.
- To test a search made before the globe loads, hold the globe chunks with CDP `Fetch` (see the skill's rules), pick the country, release the chunks, and check that the globe flies once it mounts.
- A touch tap selects through the canvas `pointerup`, and the canvas cancels `touchend` so the browser's follow-up click cannot land on the sheet's backdrop and close it.

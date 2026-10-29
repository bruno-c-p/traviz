# Landing page design

The public page at `/welcome`. A signed-out visit to `/` lands here. The rest of the app keeps the system in `src/app/globals.css`.

## Brief

- Subject: traviz, a web app where each person marks countries on a globe as visited, want to go or not interested, synced to their account.
- Audience: people who keep count of the countries they have seen, and people building a wish list.
- Job: make them sign in with an email link and start marking.
- Assets: the product's own canvas globe engine, the country dataset (250 entries, 195 sovereign countries), the app's mark colours and fonts.
- Facts used on the page come from the code: the 195 headline, the per-continent counts (Africa 54, Asia 47, Europe 45, North America 23, South America 12, Oceania 14), email-link sign-in with no password, the globe, list and stats views, territories labeled and left out of the 195.
- Assumptions: no pricing, no user numbers and no testimonials are shown, because none are known. The sample marks in the hero belong to an invented traveller and are labeled as a sample. Marks made on this page stay on this page.

## Concepts

|                                 | Idea                                                                                                                                           | Anchor                                             | Signature                                                               | O / F / Fe / P |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- | -------------- |
| A. Formal system: the roll call | The hero is all 195 country names set as one paragraph, A to Z. You mark them right there, and the real globe turns to each name and paints it | the 195 headline and the list view are the product | pick a name: its fill paints in, the globe flies to it, the counts move | 4 / 5 / 5 / 2  |
| B. Material: one turn           | The page is one rotation of the real globe. Scroll is longitude, and each continent is a chapter as it faces you                               | the product's canvas globe and its spin            | scroll turns the globe through the six continents                       | 4 / 4 / 3 / 3  |
| C. Process: the scratch map     | The page is a scratch-off poster, and the pointer scratches foil off the countries                                                             | how people tracked travel before apps              | scratch to reveal the colours                                           | 3 / 3 / 3 / 4  |

Pick A. It is the product's own interaction (pick a country, mark it) and its own number, so it cannot move to another brand. It is cheap to build well on the existing globe, and the first frame is real text. Stolen from B: the globe keeps its slow spin as the idle state.

## Concept card

```
Idea:        Every country in the world, set as one paragraph you can mark.
Metaphor:    A roll call: 195 names read out A to Z, each one answered.
Signature:   Pick a name. Its colour paints in from the left, the globe beside it flies there and paints the country, and the counts tick.
Emotion:     "That is all of them, and I have already been to some." Recognition, then the urge to count.
Motion verb: Paint in, the way a country fills with its colour on the globe.
Screenshot:  The wall of names with a dozen painted lime and violet, the globe turned to the last one picked.
```

## System

Palette (the app's own mark colours, so the page and the product read the same marks):

| Role    | Hex                    | Use                                              |
| ------- | ---------------------- | ------------------------------------------------ |
| ground  | `#f4f6f1`              | page                                             |
| ink     | `#0e0f0c`              | type                                             |
| muted   | `#5e615c`              | unmarked names, secondary text (5.7:1 on ground) |
| line    | `#d9ddd5`              | hairlines                                        |
| visited | `#9fe870` on `#163300` | visited fill, primary action                     |
| want    | `#7a5af8` on `#ffffff` | want-to-go fill                                  |
| skip    | `#b9bdb5` on `#0e0f0c` | not-interested fill                              |
| curtain | `#163300`              | the primary action's hover fill                  |

Lime on off-white is the existing brand, not a pick from the AI-default list. Lime, violet and grey are used only for marks and the one primary action, so colour always means a state.

Type: Instrument Sans for everything, preloaded on `/welcome` only by `src/app/welcome/layout.tsx`, so the wall never reflows when the font arrives, 700 with -0.045em tracking at display sizes, 500 for the names. Geist Mono, tabular, for counts only. No new font files.

Grid: 12 columns, gutter `clamp(16px, 2vw, 32px)`, outer margin equals the gutter. At 1024 px and up the hero hangs on two lines: column 1 (the sticky panel, 4 columns) and column 5 (the wall, 8 columns). Below that, one column with the panel's count in a sticky bar at the bottom of the hero.

Rhythm: hero full height and longer (the wall runs past the fold), continents airy, views normal, finale full viewport.

Shape: a radius of about a quarter of the short side, capped at 8 px (8 px on name fills, 3 px on 14 px squares). Pills only for buttons.

Motion: one ease, `cubic-bezier(0.23, 1, 0.32, 1)` (the app's `--ease-out`). Paint-in 420 ms for a name, 300 ms for a cell, 500 ms for the action fill. Hover lines draw in 240 ms. The globe flies in 1.2 s (the engine's own `flyTo`). Under reduced motion every fill is instant and the globe does not spin or fly.

Clock: there is no GSAP. The globe engine's frame loop is the only animation loop, and everything else is CSS transitions. Each route here has a JS budget in `bundle-budget.json`, and the globe already owns its frames.

Idle: the globe spins at 1.5 degrees per second, the same as on `/`, paused under reduced motion. It pauses for 4 s after each fly-to.

Interaction, one treatment per role:

- Name buttons: a 3 px line in the colour the next pick will give draws under the name on hover and focus, so it shows what a pick does. A pick paints the fill.
- Primary action (Start your map): the dark fill paints in from the left and the label turns lime under it.
- Secondary action (Sign in, Clear sample): an ink fill paints in from the left and the label turns white.
- Giant closing link: a lime band sits under it at rest, so touch sees it is a link, and the lime fill paints across it on hover.
- Island dots in the Globe row: the dot grows and the row fills grey, and a pick repaints the dot like the wall.
- Utility links (credits): underline at rest, colour change.

### Composition

```
1440, hero                                         390, hero
traviz                                 [Sign in]   traviz           [Sign in]
+---------------+-------------------------------+  Keep count
| Keep count    | Afghanistan Albania Algeria   |  of the world.
| of the world. | Andorra Angola Antigua and    |  para, [Start your map]
| para          | Barbuda Argentina Armenia ... |  (  globe  )
| [Start map]   | ... 195 names, A to Z ...     |  caption
|  (  globe  )  |                               |  names, names, names
| 12 / 195      |                               |  ...
| legend, clear |                               |  [12/195 . legend . clear] sticky
+---------------+-------------------------------+

Continents (data family)                           Views (index rows)
Where your count stands                            Globe   | sentence
Africa   3 of 54   [cells, one per country]        List    | sentence
Asia     ...                                       Stats   | sentence
                                                   Sign-in | sentence
Finale (poster)
Start your map.        (whole line is the link, mega type)
one line on the email link    credits
```

404: "Not on the map." with "map" painted in the skip grey, and a way back.

## Genericness test

A generic answer to "landing page for a travel tracker" is a centred headline over a spinning globe, three feature cards and a CTA. Changed:

- The hero is the data itself, 195 names, not a headline over a picture. The globe is a witness to the names, not the hero image.
- The features are not cards. The continent section is the stats view in miniature, one cell per country, driven by the visitor's own picks.
- The visitor uses the product before signing in, instead of reading about it.

## Decisions from QA

- The wall is left-aligned. Justified, it opened 80 to 100 px gaps around long names.
- The Globe, List and Stats rows each carry a live specimen of the same marks (island dots, list rows, the 195 bar), so the concept runs past the hero.
- Below 1024 px the globe scrolls away while you pick, so the pinned bar shows the last pick as a painted chip.
- The 404 uses a plain `<a>`. A `next/link` in the root not-found added about 3.6 KB to every route's first load.

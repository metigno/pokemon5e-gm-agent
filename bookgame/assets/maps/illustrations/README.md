# M01 Offline Map Illustrations

This directory contains **decorative pixel-art vignettes**, not navigable
tilemaps, distances, geographical coordinates, or additional narrative maps.

- `m01-ginestre.png` — 320×192, SHA-256 `b0f6832c27f583260bf3c7132ef7fc4df1a8606b1a9cedc0cb0bc5f50313bfe3`
- `m01-valedarsena.png` — 320×192, SHA-256 `70d1197c2333a465dc693b67fa11b0b2035368d281c8b54f38d69202d863dcb6`

**Provenance:** both are built from `world.png` and `exterior.png` in
`openRPG_Tilesets_5.24.22.zip`, the source archive locked in
`content/maps/MAP_ASSET_LIBRARY_V1.json` with SHA-256
`2bbd8d0481da6cee763164d13a3f41aa1383016ce7c6211c436072bbf5040b77`.
The archive's `ReadMe.txt` declares its art **CC0/public domain**.
Source: https://finalbossblues.itch.io/openrtp-tiles

Only locations already authored in M01 are bound to these vignettes.
All navigation, time, conditional access and return travel remains exclusively
under the canonical scene engine. Places without a vetted PNG retain the
schematic presentation; **full M01–M12 graphical composition is not yet complete**.

## M01 complete authored-location image coverage (next pass)

The M01 scene and `set_location` audit enumerates 16 distinct authored
location IDs, all mapped to a bundled offline file. Thirteen new SVG maps
use **original authored tile-like vector compositions** (no third-party
sprite copying or disputed license assumptions); two earlier PNGs derive
from the audited OpenRPG CC0 sheet. The image mappings may deliberately
reuse a shared road vignette, as permitted by the environment-class rule.

The SVGs are static decor at 320×192 logical grid coordinates (640×384
output), with nearest-neighbour / crisp edges. They do **not** define
physical travel distances, scene nodes, biomes, or story reachability.
Neither the game engine nor existing playable scene JSON was modified for
this pass. The UI remains a click-to-travel **schematic** map until a
separately audited world atlas with verified position data exists.

No other unverified source raster or archive is embedded in this release.
M02–M12 will reuse this same allowlisted offline route for their own
canonical locations, in separate audited steps.

## M02 authored-location illustration pass

The 15 canonical playable `m02-*.json` files reference **nine** unique
location IDs through scene origins and `set_location` effects. This pass
adds four original, self-contained offline SVG compositions:

- `m02-borgo-salice.svg` — village exterior
- `m02-sala-verde.svg` — green hall / trial venue interior
- `m02-mirto.svg` — marsh approach
- `m02-east-road.svg` — existing M03 transition-point road

The other five IDs deliberately reuse pre-existing approved M01 art for
the forest, city, ranger, shop or arena environment classes. No invented
new story location, world position, distance or time cost is represented.
SVG compositions are vector pixel-grid art authored for this project;
**no unverified-license third-party raster source is copied**.

## M03 authored-location illustration pass

Audit: **15 playable M03 scene JSONs, 17 distinct canonical locations**.
Eight newly authored, self-contained vector pixel-grid illustrations provide
the quarry, quarry road, Ferravia, archive, station, workshop, Ferrox access
and rescue perimeter environments. The other nine M03 location IDs reuse
already vetted M01/M02 image classes (shop, arena, ranger, ecology,
Borgo Salice, Valedarsena, trial hall and transition road).

No battle range, actual geographical location or authored scene path is
inferred from the art. As with M01/M02, these are offline decorative
visuals for the existing schematic, clickable navigation only.

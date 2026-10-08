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

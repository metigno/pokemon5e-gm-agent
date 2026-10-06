# MAP ASSET LIBRARY V1 — LOCK

**Status:** LOCKED ASSET AUDIT / BINARY IMPORT PENDING  
**Scope:** `bookgame/` only  
**Branch:** `bookgame-p5e-runtime-full`  
**Machine-readable registry:** `bookgame/content/maps/MAP_ASSET_LIBRARY_V1.json`  
**Audit date:** 2026-10-06

## 1. Authority

This library is subordinate to:

1. `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`
2. `P5E_LIBROGAME_12_MODULES_MASTER.md`
3. the actual M01→M12 module/scene production files

It creates **no new map engine**. Its job is to make the supplied art reusable and deterministic so scenes can reference a small set of environment classes instead of inventing ad-hoc art choices.

## 2. Supplied asset audit

| Source | Audit result | Map role |
|---|---|---|
| `RPG Nature Tileset.png` | 1536×690, SHA-256 `7a509055…bddb90cf` | Main temperate nature/grass/dirt/water/rock source |
| `RPG Nature Tileset Autumn.png` | 1536×922, SHA-256 `7e86bcc2…3f05ff3d` | Autumn/dry/barren nature variant |
| `IceTileset.png` | 1536×691, SHA-256 `9af69816…a467953` | Snow, ice, frozen water, cold mountain/stone |
| `openRPG_Tilesets_5.24.22.zip` | 5 tilesets + ReadMe, SHA-256 `2bbd8d04…5040b77` | Towns, interiors, caves/mines, ships/ports, macro-world |
| `Mighty Pack 2023.rar` | manifest audited, SHA-256 `135e563e…39c872d` | **Excluded from map library**: contents are character/battler-oriented, not map tiles |

The OpenRPG ReadMe supplied inside the ZIP explicitly states a **CC0/public-domain** release and a **16×16 tilebase**. Its five sheets are `dungeon.png`, `exterior.png`, `interior.png`, `ship.png` and `world.png`, each 480×256.

The three large Nature/Ice sheets are accepted as user-supplied production assets, but their license is deliberately recorded as **unverified**: no license metadata was found in the supplied rasters, so the library does not invent redistribution rights.

The RAR contains `Terms of Use.txt`, but the current environment could only inspect its archive manifest. Because its actual usable art is `Monsters.png`, four side-view hero battlers and `Giant Rat.png`, it is not needed for map/location production and stays outside this library.

## 3. Locked environment classes

- **temperate_nature** — Nature + OpenRPG exterior/world.
- **autumn_barren** — Autumn sheet.
- **snow_ice_highlands** — Ice + OpenRPG dungeon/world.
- **water_river_coast** — Nature + OpenRPG exterior/ship/world.
- **town_village_exterior** — OpenRPG exterior.
- **building_interior** — OpenRPG interior.
- **cave_mine_industrial** — OpenRPG dungeon.
- **ship_port** — OpenRPG ship + exterior.
- **ruins_stone** — Nature/Autumn + OpenRPG dungeon/exterior.
- **macro_world** — OpenRPG world.
- **tournament_venue** — composed from exterior/interior/dungeon; currently partial for modern stadium language.
- **institutional_modern** — composed from interior/exterior; currently partial for media, sports medicine and sponsor spaces.

This is the reuse contract. Scenes should select an environment class and then a concrete composition/state variant, rather than binding directly to arbitrary files.

## 4. M01→M12 coverage

| Module | Main places | Coverage with supplied assets |
|---|---|---|
| **M01** | Campus Licenze, Ginestre, Valedarsena, Fattoria del Vento | **Strong**; only wind-farm-specific props are a small gap |
| **M02** | Bosco Bruma, Borgo Salice, Palude Mirto | **Strong**; dedicated marsh/reed props optional |
| **M03** | Cava Grigia, Ferravia, Gallerie Ferrox | **Strong**; railway/station dressing may need composition |
| **M04** | Mareasale, Costa di Sale, Barriera Azzurra | **Strong** with ship/coast/water sheets |
| **M05** | Monti Ferrox, Altacima, Altopiano Fulgore | **Strong**; Ice sheet is the main visual source |
| **M06** | Solaria/Luminara, Masters, Continental Cup, Primo Faro | **Medium**; lighthouse and modern tournament dressing remain specific gaps |
| **M07** | Meridiana, Grand Hall, arena, media/sponsor, station, medicine sportiva | **Partial**; modern-city/world-class-sports identity is the main missing family |
| **M08** | World Village, medical, training hall, media, opening ceremony, draw | **Partial**, but one World-venue composition can be reused |
| **M09** | World Group Stage | **Partial by reuse** of M08 venue |
| **M10** | R16 + QF | **Partial by reuse** of M08 venue |
| **M11** | SF + Final | **Partial by reuse** of M08 venue |
| **M12** | callbacks across Asteria | **Strong by reuse**; no new environment class is allowed/needed |

## 5. Production gaps, in order

1. **World/Meridiana modern venue family** — affects M07→M11; this is the only high-priority visual gap.
2. **Railway/Ferravia dressing** — medium.
3. **Primo Faro prop/landmark** — medium.
4. **Wind-farm dressing** — low.
5. **Marsh/reed dressing** — low.

The rule is **composition/overlay first**. Do not add a second map architecture merely to solve these props.

## 6. Import/rendering rules

1. raw source files remain immutable;
2. derived atlases/compositions are separate outputs;
3. pixel art uses nearest-neighbour filtering only;
4. OpenRPG may be sliced as 16×16 according to its supplied documentation;
5. do **not** auto-slice the three 1536px Nature/Ice sheets until their intended tile boundaries and black-background/transparency treatment are explicitly fixed;
6. maps remain offline assets;
7. M12 reuses prior location assets and state variants rather than creating replacement maps.

## 7. Next implementation step

The next asset pass is now bounded: import the map-eligible binaries into the Bookgame asset surface, create the first canonical compositions for **M01 Valedarsena/Ginestre/Fattoria del Vento**, and use those as the template for subsequent location maps.

No work is required on Pokémon Sports Career or on the original GM Agent outside the existing Bookgame bridge.

# ASTERIA FAUNA RUNTIME LOCK

Status: **LOCKED / PASS**

## Source baseline

- Repository: `Auroratide/poke5e`
- Pokémon 5e edition: **2024**
- canonical Pokémon data blob: `f78ec73c8ed932d77eb60ef535cb3730e79ecd0a`
- evolution data blob: `773431451b1a9882d82139bb691249db39b7a424`

## Verified coverage

- canonical stat-block records: **1,139**
- indexed records: **1,139**
- National Pokédex species represented: **1,025**
- generations: **1–9**
- missing canonical records: **0**
- extra non-source records: **0**
- ordinary fauna without a valid Asteria zone: **0**
- invalid location references: **0**

## Paradox verification

Past:
Great Tusk, Scream Tail, Brute Bonnet, Flutter Mane, Slither Wing, Sandy Shocks, Roaring Moon, Walking Wake, Gouging Fire, Raging Bolt.

Future:
Iron Treads, Iron Bundle, Iron Hands, Iron Jugulis, Iron Moth, Iron Thorns, Iron Valiant, Iron Leaves, Iron Boulder, Iron Crown.

Legendary-scale anomaly cases:
Koraidon, Miraidon.

Total Paradox-related records verified: **22**.

## Runtime authority

1. `SPECIES_DISTRIBUTION.json`
2. `ZONE_POOLS.json`
3. `FAUNA_COVERAGE.json`
4. `RARITY_SYSTEM.md`
5. `SPECIAL_ENCOUNTERS.md`
6. `gm_private/ASTERIA_SPECIAL_FAUNA.json` for private event anchors

Overlapping files under `campaign/world/fauna/` are supporting/generated references and do not override this runtime set.

## Encounter invariant

Ordinary encounters must come from an ecologically valid zone pool after world-state/time/weather filtering.

Legendary, Mythical, Ultra Beast, Fossil-restricted and Paradox records are event/access controlled and cannot be produced by a normal random encounter roll.

## Final result

**PASS — complete all-generation Pokémon 5e fauna coverage for Asteria, including all current Paradox records.**

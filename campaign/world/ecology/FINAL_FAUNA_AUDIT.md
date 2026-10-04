# FINAL FAUNA AUDIT — ASTERIA

Status: **PASS**

Source baseline:
- Pokémon 5e repository: `Auroratide/poke5e`
- Pokémon 2024 canonical dataset blob: `f78ec73c8ed932d77eb60ef535cb3730e79ecd0a`
- Evolution dataset blob: `773431451b1a9882d82139bb691249db39b7a424`

## Coverage

The Asteria fauna registry contains **1,139 canonical Pokémon records**.

This count includes canonical alternate/regional/forms represented by the Pokémon 5e dataset; unofficial/Fakémon records are excluded.

Generation coverage:
- Gen 1: 151
- Gen 2: 100
- Gen 3: 140
- Gen 4: 116
- Gen 5: 163
- Gen 6: 77
- Gen 7: 116
- Gen 8: 144
- Gen 9: 132

Total: **1,139**

Validation:
- assigned records: 1,139 / 1,139
- unassigned records: 0
- duplicate species records: 0
- invalid location records: 0
- canonical IDs unique: PASS

## Ordinary fauna

**955** records are valid ordinary/protected/scarce Asteria wildlife.

Every one of those 955 records occurs in at least one normal Asteria zone pool.

Missing ordinary species from zone pools: **0**

Special/event-only species accidentally present in normal random pools: **0**

The registry maps the complete set of official Pokémon 5e biome tags:
- abyss
- badland
- beach
- cave
- city
- desert
- field
- forest
- glacier
- grassland
- industrial
- jungle
- lake
- mountain
- ocean
- polar-sea
- pond
- reef
- river
- riverside
- ruin
- swamp
- tundra
- volcano
- woodland

Unmapped official biome tags: **0**

## Special fauna

**184** canonical records are intentionally excluded from normal random wildlife pools.

Breakdown:
- Legendary records: 99
- Mythical records: 26
- Fossil / paleo-restricted records: 25
- Ultra Beasts: 11
- ordinary Paradox records: 20
- legendary-scale Paradox records: 2
- unique special: 1

These categories require their dedicated event/access rules.

## Paradox verification

All current Paradox Pokémon in the source are represented.

### Ancient
- Great Tusk
- Scream Tail
- Brute Bonnet
- Flutter Mane
- Slither Wing
- Sandy Shocks
- Roaring Moon
- Walking Wake
- Gouging Fire
- Raging Bolt

Registry: `CHR-PAST — Frattura Cronale Arcaica`

### Future
- Iron Treads
- Iron Bundle
- Iron Hands
- Iron Jugulis
- Iron Moth
- Iron Thorns
- Iron Valiant
- Iron Leaves
- Iron Boulder
- Iron Crown

Registry: `CHR-FUTURE — Frattura Cronale Futura`

### Legendary-scale Paradox
- Koraidon
- Miraidon

They are not members of an ordinary anomaly encounter roll. Each requires a dedicated story event.

Total verified Paradox records: **22**

## Regional forms

**54** records are handled as localized regional micro-populations.

They do not replace the standard form across Asteria.

Their habitat is derived from the current Pokémon 5e biome metadata and localized to compatible Asteria zones.

## Rarity

Ordinary distribution uses:
- Common
- Uncommon
- Rare
- Very Rare
- Exceptional
- Protected Rare
- Protected Very Rare

Special-only classes use:
- Paleo
- Legendary Unique
- Mythical Unique
- Ultra Rift
- Anomaly
- Legendary Anomaly
- Unique Event

Weights are relative encounter weights, not percentages.

Rarity never overrides habitat, time, weather, world-state or behavior.

## Protected starter populations

Starter families may exist as wild populations, but they are deliberately protected/scarce.

They do not become common merely because a game normally gives them to a protagonist.

Repeated capture pressure may change local ecology and trigger Ranger/world consequences.

## Fossils

Fossil species are not treated as ordinary modern wild populations.

Their Asteria access is through fossils, research, managed revival or a specific story/ecological event.

Primary anchors include Cava Grigia, Gallerie Ferrox, Rovine del Primo Faro and Meridiana research facilities.

## Legendary / Mythical rule

A registry location is only a possible story anchor, clue location or gateway.

It is **not a spawn point**.

Canonical lore and already-established character arcs take precedence over Asteria's generic special-event metadata.

## Encounter authority

`SPECIES_DISTRIBUTION.json` and `ZONE_POOLS.json` decide ecological availability.

They do not contain authoritative combat stat blocks.

When a Pokémon becomes an actual encounter:
1. select it from a valid Asteria ecological pool/event;
2. establish behavior and world context;
3. retrieve/use current Pokémon 5e mechanics;
4. resolve normally with honest dice.

## Files

- `SPECIES_DISTRIBUTION.json` — species/form → Asteria distribution
- `ZONE_POOLS.json` — Asteria location → rarity pools
- `RARITY_SYSTEM.md` — rarity rules
- `BIOME_COVERAGE.md` — biome mapping
- `SPECIAL_ENCOUNTERS.md` — Paradox/UB/Legendary/Mythical/Fossil rules
- `FAUNA_COVERAGE.json` — machine-readable validation
- `FINAL_FAUNA_AUDIT.md` — this audit

## Final result

**PASS — complete canonical Pokémon 5e fauna coverage for Asteria, including Gen 9 DLC and all Paradox records present in the current Pokémon 5e source.**

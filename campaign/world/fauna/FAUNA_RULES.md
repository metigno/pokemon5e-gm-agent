> **Runtime authority notice:** this directory contains generated/supporting fauna references. If any value here conflicts with the current runtime ecology set, use `campaign/world/ecology/SPECIES_DISTRIBUTION.json`, `ZONE_POOLS.json`, `FAUNA_COVERAGE.json`, `RARITY_SYSTEM.md` and `SPECIAL_ENCOUNTERS.md` as authoritative.

# ASTERIA FAUNA RULES

## Source of truth

Asteria's fauna distribution is generated from the current canonical **Pokémon 5e 2024** species data in `Auroratide/poke5e` at commit:

`b411a993eba07f36218f8ea70dd2c402e2e7c91a` — v1.12.15.

The source provides official biome tags such as forest, city, cave, ocean, swamp, glacier and others.

Asteria uses those biome tags as the first ecological authority.

## Complete coverage

The generated index includes every canonical stat block in that source, including:
- Generations 1–9;
- regional forms;
- official alternate forms;
- fossils;
- Legendary and Mythical Pokémon;
- Ultra Beasts;
- all Paradox Pokémon currently present in Pokémon 5e, including DLC Paradox Pokémon.

See:
- `ASTERIA_FAUNA_INDEX.json`
- `ZONE_TABLES.json`
- `COVERAGE_REPORT.json`

## Rarity

Normal fauna uses five rarity bands:

- **common**
- **uncommon**
- **rare**
- **very_rare**
- **exceptional**

Rarity derives from Pokémon 5e SR, minimum level, evolution stage, breadth of known regional distribution and special family rules.

Rarity is ecological frequency, NOT capture chance.

The GM must still use exact Pokémon 5e capture mechanics.

### Minimum rarity floors

To keep cross-generational biodiversity believable:
- starter families begin at **rare** and later stages become **very rare / exceptional**;
- pseudo-legendary families follow the same minimum floor;
- Eevee, Riolu, Zorua, Larvesta and Charcadet families receive special rarity floors;
- populations documented in only one source region cannot be common in Asteria;
- regional forms restricted to one known region are at least rare.

The **Riserva Paleobiologica** is not part of ordinary biome rolls. Only its controlled fossil populations use that zone.

## Evolution ecology

Evolution stages usually become progressively rarer in the wild.

A final evolution can still exist naturally, but it should not appear as often as the base stage merely because both share the same biome.

Evolution families are deterministically clustered so their later stages tend to remain in subsets of the same ecological zones.

## Starters

Starter families exist in the world as real fauna, but their wild populations are intentionally rarer than ordinary early-route species.

Receiving a starter does not mean that species is unique to laboratories.

## Pseudo-legendary families

Pseudo-legendary lines are present in appropriate habitats but are deliberately rare, with later stages especially scarce.

## Regional forms

Regional forms use their own Pokémon 5e biome data when available.

Asteria is interregional, so small naturalized populations can exist outside their original home region, but limited-source forms become localized micro-populations rather than ubiquitous fauna.

## Fossils

Fossil Pokémon are not ordinary random encounters.

Asteria maintains the regulated **Riserva Paleobiologica di Asteria** where revived lines can exist as controlled living populations.

Fossil remains can also be discovered at quarry/ruin sites, but finding a fossil is not the same as meeting a living specimen.

## Alternate battle/transformation forms

A stat block representing a form/state without its own habitat is not automatically a separate wild population.

Examples include temporary, fused, transformed or special battle states.

Such entries are marked `form_state` and cannot be rolled independently as random fauna.

## Legendary and Mythical Pokémon

Never place a Legendary or Mythical Pokémon into an ordinary random encounter table.

They require a real world/event chain.

They are not guaranteed captures, and appearance does not imply willingness to battle or be captured.

Exact hidden Asteria anchors live in `gm_private/ASTERIA_SPECIAL_FAUNA.json`.

## Ultra Beasts

Ultra Beasts are not native wildlife.

They can enter Asteria only through an Ultra Space/incursion-equivalent world event.

No routine biome roll can generate one.

## Paradox Pokémon

Paradox Pokémon are included, but are NOT normal fauna.

They require a temporal anomaly chain.

Past and future Paradox Pokémon have logical environmental anchors, but their exact locations remain GM-private until discovered.

See `PARADOX_PROTOCOL.md`.

## Encounter resolution

When a wild encounter becomes possible:

1. determine the current Asteria zone;
2. read the zone table;
3. apply time, weather, ecological stress and recent world events;
4. choose/roll within an appropriate rarity band;
5. give the Pokémon a plausible behavior goal;
6. fetch the current exact Pokémon 5e stat block;
7. resolve mechanics through Pokémon 5e.

Do not invent a species solely because the player asks for it.

## Relative weights

The generated `relative_weight` values are ecological guidance, not percentages:

- common: 40
- uncommon: 22
- rare: 10
- very rare: 4
- exceptional: 1

The GM may filter before weighting because of time/weather/fiction.

## Shiny Pokémon

Shiny status is separate from species rarity and follows the campaign's active shiny rules.

Do not encode shiny variants as separate fauna species.

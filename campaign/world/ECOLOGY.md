# ECOLOGY & ENCOUNTER DIRECTOR — COMPLETE FAUNA

## Canonical registry

Asteria now has a complete fauna registry at:

`campaign/world/ecology/SPECIES_DISTRIBUTION.json`

It contains every canonical Pokémon record currently exposed by the Pokémon 5e source used by this project, including regional forms and Gen 9/Paradox records.

Unofficial/Fakémon records are excluded.

The reverse location pools are stored in:

`campaign/world/ecology/ZONE_POOLS.json`

## Source discipline

Pokémon 5e remains mechanical authority.

The ecology build uses the upstream species list, biome metadata, encounter-difficulty profile and evolution graph only as inputs to derive **new Asteria-specific distribution data**.

The upstream stat blocks are not copied into this repository.

When a species becomes a real encounter, fetch/use its current Pokémon 5e rules instead of treating the ecology file as a stat block.

## Encounter pipeline

1. Determine exact location.
2. Apply world-state changes and ecology flags.
3. Check time/daypart.
4. Check weather and habitat access.
5. Build the valid local pool from `ZONE_POOLS.json`.
6. Filter by current ecological/story conditions.
7. Weight by local rarity.
8. Choose/roll an encounter only if an encounter is actually warranted.
9. Give the Pokémon a plausible behavior/goal.
10. Resolve with Pokémon 5e if interaction becomes mechanical.

Walking for enough minutes does not guarantee a battle.

## Behavior states

Possible states include:
- foraging;
- territorial;
- frightened;
- curious;
- nesting;
- hunting;
- injured;
- displaced;
- habituated_to_humans;
- defending_resource;
- fleeing_another_threat.

## Rare sightings

Rare+ sightings should usually gain at least one fiction signal:
- tracks;
- calls;
- unusual damage to terrain;
- rumor;
- Ranger note;
- ecological clue;
- distinctive weather/time condition.

The signal does not guarantee capture.

## Protected populations

Starter families and some scarce breeding populations can be wild in Asteria, but their low density is deliberate.

Do not turn a protected population into a farming loop.

Repeated pressure can change the area's world-state and Ranger response.

## Special fauna

Paradox, Ultra Beast, Legendary, Mythical and fossil classes follow `SPECIAL_ENCOUNTERS.md`.

They never enter ordinary random pools.

## Persistent ecology

Location ecology may change through:
- repeated captures;
- migration;
- fire;
- industrial disturbance;
- restoration;
- weather;
- predator displacement;
- world events;
- Ranger action.

Record only changes that can matter later.

## No auto-scaling

Ecology is independent of Trainer Level.

A powerful mature Pokémon may exist in an accessible habitat.

Use warning signs rather than silently weakening it for the player.


## Complete Pokédex distribution

The authoritative Asteria fauna distribution is now generated from Pokémon 5e 2024 official biome data.

Use:
- `fauna/FAUNA_RULES.md`
- `fauna/FAUNA_ZONES.json`
- `fauna/ASTERIA_FAUNA_INDEX.json`
- `fauna/ZONE_TABLES.json`
- `fauna/COVERAGE_REPORT.json`

Do not improvise a wild species outside this distribution unless a world event explicitly changes local ecology.

Legendary, Mythical, Ultra Beast, Paradox and unique-event placements are GM-private and never random.

# Legendary encounters — canonical module-level Pokémon 5e guardrails

Authority: `bookgame/docs/P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`
sections 40 and 45, plus the persistent Five careers. This document never
grants a Pokémon, alters capture rolls or imports videogame-form mechanics.

## Actual Pokémon level caps

| Module | Pokémon cap | Authored legendary status on the canonical branch |
| --- | ---: | --- |
| M07 | 16 | Investigation / clues only; no capture encounter |
| M08 | 18 | Qualification / personal clues only; no capture encounter |
| M09 | 20 | First World Championship stage; optional capture work is in PR #82 |
| M10 | 20 | World knockout; no second automatic encounter |
| M11 | 20 | World semifinals/final and evidence; no automatic ownership |
| M12 | 20 | Epilogue and postgame; no automatic encounter |

A cap is a **maximum legal Pokémon level**, not a level equalization command.
A sighting has no combat level; do not insert fictitious legendary battles
into M07 or M08. A real encounter level must be legal for its species and
checkpoint under the pinned offline 2024 Pokémon 5e species pack.

## Five legendary species (not videogame builds)

- Luke: Black Kyurem; treat the Kyurem/Zekrom fusion as a specific authored
  condition, never as a free gift, forced transformation or second captured slot.
- Mattew: Zacian; Crowned is not automatically unlocked or granted with capture.
- Daniel: Mewtwo.
- Edward: Lugia.
- Fab: Rayquaza; Mega Rayquaza is not automatically available.

**M09 integration note:** separate open PR #82 currently authors real, optional
World encounters at fixed Pokémon 5e levels: Black Kyurem Lv20, Zacian Lv20,
Mewtwo Lv20, Lugia Lv20, and Rayquaza Lv18. The first four require Trainer
Lv20 for legal capture according to that PR; Rayquaza requires Trainer Lv18.
These encounter levels are **specific to the PR's authored M09 battles**, not
a blanket rule for all later or earlier sightings. They become playable only
when that PR has passed tests and been merged.

For M10–M12 do not generate a new legendary copy, increment its level, or
scale it to the current player. If an authored later encounter is introduced,
its own stable `moduleId`, `checkpointId`, `speciesId`, `formId`,
`pokemonLevelCap`, `encounterLevel`, `locationId` and persistent
`outcomes` must be declared before combat is enabled. Reuse existing Asteria
locations and the current Pokémon 5e combat/capture resolver.

Each personal quest is optional and nonblocking. A missed/failed capture
never awards ownership or a guaranteed retry. Repeat encounters need an
explicitly authored cooldown/future trigger, and captured Pokémon must not
be duplicated in saves. Species that the offline pack cannot legally resolve
must fail validation, never be silently replaced by convenient substitutes.

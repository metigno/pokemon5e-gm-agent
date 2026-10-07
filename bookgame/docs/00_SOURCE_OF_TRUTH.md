# Pokémon 5e Digital Bookgame — Source of Truth

## Project status

The Digital Bookgame is a distinct project line inside the existing Pokémon 5e GM Agent repository.

- Repository: `metigno/pokemon5e-gm-agent`
- Canonical Bookgame branch: `bookgame-canonical`
- Integration work must target `bookgame-canonical` through reviewed branches/PRs.
- `main` remains the Pokémon 5e GM Agent line and must not be used as the Bookgame gameplay baseline.

## Authority hierarchy

When documents overlap, use this order:

1. `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md` — rules/runtime authority.
2. `P5E_NARRATIVE_REFERENCE_MASTER_V1.md` — player-facing screenplay/narrative authority.
3. `P5E_LIBROGAME_UI_UX_MASTER_SPEC_V1.md` — interaction and information-architecture authority.
4. `P5E_LIBROGAME_VISUAL_DESIGN_SYSTEM_V1.md` — visual-system authority.
5. module design + production mapping.
6. validated runtime contracts, tests and authored content.

Core separation:

> **THE RUNTIME OWNS THE RULES. THE SCREENPLAY SHOWS THE WORLD. THE UI PRESENTS LEGAL STATE AND ACTIONS.**

A narrative or visual improvement is never permission to duplicate, bypass or silently rewrite validated Pokémon 5e mechanics.

## Non-negotiable separation

This project DOES NOT replace the Pokémon 5e GM Agent.

The existing Agent remains on `main` and must not be modified by Bookgame development.

Changes made here belong to the Digital Bookgame unless explicitly ported later.

## Product definition

The target product is a standalone digital gamebook / interactive-fiction RPG based on Pokémon 5e concepts.

The player starts with:

```
NEW GAME
→ character creation / campaign setup
→ written scene
→ player choice
→ rules / dice resolution
→ consequence
→ next written scene
→ persistent save
```

The core experience must be playable without ChatGPT and without an internet connection.

## Offline-first rule

Internet and external LLMs may enhance the game, but they must never be required to play.

The local game must own:

- rules resolution
- dice
- checks
- combat
- player and Pokémon state
- inventory
- quests
- NPC state
- world flags
- time
- encounters
- branching
- save/load
- written narrative content

## Engine authority

The deterministic/local engine is authoritative.

Narrative text never changes game state directly.

Required flow:

```
PLAYER CHOICE
→ VALIDATE
→ RESOLVE RULES
→ ROLL / CALCULATE
→ APPLY STATE CHANGES
→ SELECT RESULT BRANCH
→ RENDER WRITTEN NARRATIVE
→ SAVE
```

## Narrative model

This is not a fixed page-number gamebook.

Content should be built from reusable authored scenes with:

- prerequisites
- triggers
- choices
- checks
- success/failure branches
- variables
- flags
- consequences
- reusable event templates

The world can therefore combine authored material with system state without requiring an AI to invent canon.

## Pokémon world model

Wild Pokémon are treated as living fauna rather than random disposable encounters.

The content model should support:

- habitat
- rarity
- temperament
- territorial behavior
- solitary / pair / pack behavior
- predator / prey relationships
- Alpha and other exceptional encounters
- injury / fear / hunger / hostility
- logical regional distribution
- persistent consequences

## Combat

Narrative scenes can enter the Pokémon 5e combat resolver.

Combat outcomes are calculated by the rules engine and return to authored narrative branches.

The prose must describe mechanical outcomes naturally instead of exposing raw engine logic unless the UI intentionally shows the roll.

## AI policy

AI is OPTIONAL.

Possible future adapters:

- no AI: contextual choices only
- local parser / local LLM
- online ChatGPT / Claude / other providers

All adapters must call the same underlying game engine and use the same save format.

No LLM may be the authoritative world state.

## Initial architecture direction

```
bookgame/
├── engine/
│   ├── rules
│   ├── dice
│   ├── checks
│   ├── combat
│   ├── encounters
│   ├── time
│   └── state
├── content/
│   ├── scenes
│   ├── encounters
│   ├── pokemon
│   ├── npcs
│   ├── quests
│   └── locations
├── world/
│   ├── ecology
│   ├── spawn_tables
│   └── schedules
├── narration/
├── saves/
└── adapters/
```

This layout is a direction, not yet an implementation lock.

## First engineering objective

Before authoring thousands of scenes, build the smallest offline vertical slice proving:

1. New Game
2. persistent player state
3. one location
4. one authored encounter
5. one d20 check
6. at least two outcome branches
7. one Pokémon 5e combat handoff
8. save
9. close application
10. reload and continue from the exact state

Only after this works should content scale up.

# Vertical Slice 01 — Offline Bookgame Runtime

## Implemented

This slice proves the first complete offline Bookgame loop without ChatGPT, network access, or third-party runtime packages.

### Narrative / save loop

- New Game
- protagonist selection from the five inherited rookie builds
- authored Asteria scene
- contextual choices
- WIS / Animal Handling d20 check
- deterministic success and failure branches
- durable world flags
- Pokémon 5e combat handoff
- combat result returns to the authored narrative graph
- atomic local JSON saves
- save / close / reload from the exact story or combat state
- terminal UI

### Pokémon 5e combat core

- local 1v1 combat
- initiative
- action and bonus-action economy
- AC / attack rolls
- advantage / disadvantage
- natural 1 / natural 20 critical hits
- Pokémon HP scaled to encounter level
- level-based move damage dice
- PP consumption
- Move DC = 8 + proficiency + MOVE modifier
- saving throw proficiency
- 2024 STAB = proficiency bonus
- type vulnerability / resistance / immunity using 5e semantics
- persistent attack modifiers from supported save moves

### Status / secondary effects

Implemented from the 2024 rules:

- Burned
  - damage rolls twice, lower result
  - proficiency-bonus damage at end of turn
  - Fire-type immunity
- Poisoned
  - disadvantage on attack rolls
  - proficiency-bonus damage at end of turn
  - Poison/Steel immunity
- Paralysis
  - STR/DEX save disadvantage
  - start-turn d4 incapacitation check
  - Electric-type immunity
- Asleep
  - turn loss
  - end-turn wake check
  - three-round ceiling
- Flinched
  - disadvantage through the target's next turn

Supported secondary effects include:

- Ember → Burned on natural 19–20
- Bite → Flinched on natural 19–20
- Lick → Paralysis on natural 18–20
- Hypnosis → Asleep on failed WIS save

### Supported save moves

The current local resolver supports authored effects for:

- Growl
- Leer
- Tail Whip
- Sand Attack
- Hypnosis

### Ability hooks

Implemented:

- Intimidate
- Flash Fire
- Levitate
- Torrent
- Early Bird

Also accepted as no-op-safe for the current supported move set:

- Run Away
- Rock Head

Abilities whose required mechanics are not yet implemented are rejected if explicitly selected instead of being silently approximated.

## Run locally

Requires Node.js 20+.

```bash
cd bookgame
npm test
npm run play
```

No `npm install` is required.

## Offline combat data

The validation combat pack is local:

`bookgame/data/poke5e/vertical-slice-2024.json`

It is pinned to:

- upstream: `Auroratide/poke5e`
- ref: `b411a993eba07f36218f8ea70dd2c402e2e7c91a`
- release commit: `v1.12.15`
- ruleset: 2024

The pack currently contains only the six species needed by this slice plus the moves and ability definitions that the resolver actually supports.

This is deliberate: offline play is already real, while unsupported mechanics remain explicit rather than guessed.

## Combat authority

Narrative prose does not manufacture mechanical truth.

```
AUTHORED SCENE
→ combat handoff
→ local Pokémon 5e state
→ initiative
→ status / ability hooks
→ legal Action / Bonus Action choice
→ attack roll or saving throw
→ damage / status / ability effects
→ HP + PP + turn state persisted
→ outcome
→ authored return node
```

A mid-combat save contains round, initiative, current actor, remaining action economy, HP, PP, status state, ability state, modifiers, and combat log.

## Current fidelity boundary

The engine deliberately does not fake systems that still require implementation.

Remaining major combat gates include:

- full reaction-move framework
- positioning, movement, reach, range, areas and cover
- concentration and battlefield zones
- frightened / confused / frozen and the remaining conditions
- complete move secondary-effect catalog
- complete ability catalog
- attacks of opportunity
- switching
- multiple active Pokémon
- trainer actions and items
- capture during encounters
- wild-battle fainting / death-save flow
- complete offline species / move / item data pack

## Validation

The milestone is covered by deterministic unit/integration tests in GitHub Actions, including save/resume and the advanced 2024 mechanics above.

## Next engineering gate

Build the spatial/reaction layer needed to stop treating combatants as permanently in range:

1. positions and distance,
2. movement budgets,
3. melee reach and ranged legality,
4. reactions / attacks of opportunity,
5. battlefield areas and concentration,
6. switching and capture hooks.

All of it must remain offline, deterministic, saveable, and engine-authoritative.

# Vertical Slice 01 — Offline Bookgame Runtime

## Implemented

This slice proves a complete offline Bookgame loop without ChatGPT, network access, or third-party runtime packages.

### Narrative / save loop

- New Game
- protagonist selection from the five inherited rookie builds
- authored Asteria scene
- contextual choices
- WIS / Animal Handling d20 check
- deterministic success and failure branches
- durable world flags
- Pokémon 5e combat handoff
- combat result returns to authored narrative branches
- atomic local JSON saves
- save / close / reload from story or mid-combat state
- persistent player roster
- captured Pokémon can be added to the persistent roster
- terminal UI

### Pokémon 5e combat core

- local 1v1 combat
- initiative
- Action and Bonus Action economy
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

### Spatial combat

The combat state now owns real positions in feet.

Implemented:

- 2D coordinates for trainer and active Pokémon
- species movement speeds from the pinned offline data
- movement budget per turn
- Paralysis halves movement speed
- standard 5 ft reach for Large-or-smaller Pokémon
- 10 ft reach for larger creatures
- melee and ranged legality based on actual distance
- Quick Attack's free move of up to 10 ft
- Disengage
- attacks of opportunity when leaving reach
- opportunity attacks consume the reaction and normal PP
- Run Away blocks attacks of opportunity
- trainer movement state
- authored scenes may define starting battlefield positions

The current authored Houndour encounter starts with trainer/player at 0 ft and Houndour 20 ft away.

### Switching

2024 switching rules represented in the local engine:

- voluntary switch uses the trainer's Action
- recall requires line of sight / range up to 60 ft
- release must be within 15 ft of the trainer
- returning to a Pokéball does not provoke an attack of opportunity
- transient buffs/debuffs are cleared on return
- status state remains with the Pokémon
- concentration ends on switch
- a switched-in Pokémon cannot act during the current round
- a fainted active Pokémon may be replaced immediately using the trainer reaction
- bench HP / PP / status remain persistent

### Capture

The local resolver implements the 2024 Throw Pokéball rules:

- Throw Pokéball uses an Action
- 60 ft range
- owned ball is consumed on a legal attempt
- failed legal attempts destroy the ball
- target cannot be fainted
- target cannot be above trainer level
- registered trainer Pokémon cannot be captured
- captured Pokémon preserve level, HP, status, ability and PP state
- captured Pokémon can be returned to an authored `captured` story branch

Base DC:

```
10 + floor(SR) + Pokémon Level
```

Implemented modifiers include HP thresholds and the current 2024 ball variants, including Great, Ultra, Master, Level, Net, Nest, Quick, Dream, Timer, Dusk and contextual variants.

Capture has advantage when the target has one of the qualifying status/condition states represented by the resolver.

### Battlefield zones / concentration

Implemented area state:

- persistent circular zones in battlefield coordinates
- zone center and radius are saved
- zone source and duration are saved
- start-of-turn zone processing
- automatic expiration
- concentration ownership
- starting a replacement concentration can end the previous concentration
- switch/faint ends concentration
- damage can trigger the standard CON concentration save
- failed concentration removes the associated zone

Implemented area moves:

- Smog
  - 10 ft radius
  - concentration
  - CON save at start of turn in the area
  - damage on failure / half on success
  - poison on a failure by 5 or more
- Poison Gas
  - 15 ft radius
  - persists until the beginning of the source's next turn
  - damage at start of turn in the area
  - CON save against Poisoned

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
- Run Away

Rock Head is accepted safely for the current supported move set. Abilities whose required mechanics are not implemented are rejected when explicitly selected rather than silently approximated.

## Run locally

Requires Node.js 20+.

```bash
cd bookgame
npm test
npm run play
```

No `npm install` is required.

GitHub Actions also executes syntax checks for the playable CLI.

## Offline combat data

The validation pack is local:

`bookgame/data/poke5e/vertical-slice-2024.json`

Pinned source:

- upstream: `Auroratide/poke5e`
- ref: `b411a993eba07f36218f8ea70dd2c402e2e7c91a`
- release commit: `v1.12.15`
- ruleset: 2024

The pack remains intentionally small: six species plus the move and ability definitions currently implemented by the vertical slice.

## Combat authority

Narrative prose cannot manufacture mechanical truth.

```
AUTHORED SCENE
→ structured combat handoff
→ local Pokémon 5e state
→ initiative
→ positions / movement
→ status / ability / zone hooks
→ legal Action / Bonus Action / reaction
→ attack roll or saving throw
→ damage / concentration / status effects
→ switching / capture when legal
→ HP + PP + positions + zones + roster state persisted
→ outcome
→ authored return node
```

## Current fidelity boundary

The engine deliberately does not fake systems that still require implementation.

Remaining major gates include:

- full generic reaction-move framework beyond opportunity attacks / implemented ability reactions
- cover and line-of-sight obstacles
- vertical altitude, flight and fall damage
- difficult terrain and burrowing tunnels
- non-circular shapes such as cones, lines and emanations
- frightened / confused / frozen and remaining conditions
- complete concentration move catalog
- complete move secondary-effect catalog
- complete ability catalog
- multiple simultaneously active Pokémon
- generic trainer items beyond Pokéballs
- fleeing/chase resolver
- wild-battle death saves and stabilization
- full offline species / move / ability / item dataset
- full campaign content beyond the first authored vertical slice

## Validation

The milestone is covered by deterministic unit/integration tests in GitHub Actions, including:

- save / reload
- d20 checks
- attack / damage math
- status effects
- abilities
- action economy
- distance and range
- movement
- opportunity attacks
- switching
- capture formulas
- authored capture persistence
- zones
- concentration

## Next engineering gate

The next gate should broaden the engine from this validated vertical slice into a reusable offline Bookgame platform:

1. generalize roster and multiple encounter participants;
2. complete remaining common combat conditions/shapes;
3. expand the pinned local rules/data pack;
4. add content validation schemas for scenes, locations, encounters and quests;
5. build the first multi-scene playable chapter rather than a single encounter.

All of it must remain offline, deterministic, saveable, and engine-authoritative.

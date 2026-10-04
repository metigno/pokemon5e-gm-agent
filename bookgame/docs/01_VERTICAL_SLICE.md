# Vertical Slice 01 — Offline Bookgame Runtime

## Implemented

This slice now proves the complete first offline loop without ChatGPT, network access or third-party runtime packages.

- New Game
- protagonist selection from the five inherited rookie builds
- one authored Asteria location
- one authored wild-Pokémon scene
- contextual choices
- WIS / Animal Handling d20 check
- deterministic success and failure branches
- durable world flag changes
- Pokémon 5e combat handoff
- local 1v1 Pokémon 5e combat core
- initiative
- AC / attack rolls / natural 1 / natural 20 critical hits
- Pokémon HP scaled to encounter level
- level-based move damage dice
- PP consumption
- 2024 STAB = proficiency bonus
- Pokémon type vulnerability / resistance / immunity using 5e semantics
- combat result returns to the authored narrative graph
- battle state is stored inside the normal save
- atomic local JSON save
- close / reload from the exact story or combat state
- terminal UI

## Run locally

Requires Node.js 20+.

```bash
cd bookgame
npm test
npm run play
```

No `npm install` is required because the slice has no runtime or test dependencies.

## Offline combat data

The small validation combat pack is stored locally at:

`bookgame/data/poke5e/vertical-slice-2024.json`

It is pinned to:

- upstream: `Auroratide/poke5e`
- ref: `b411a993eba07f36218f8ea70dd2c402e2e7c91a`
- upstream release commit message: `v1.12.15`
- ruleset: 2024

Only the six species needed by this first slice and their supported basic attack-roll moves are included. This is intentional: it proves the offline architecture without bulk-vendoring the entire upstream dataset yet.

## Combat authority

The Bookgame narration still cannot manufacture a combat result.

The flow is now:

```
AUTHORED SCENE
→ combat handoff
→ local Pokémon 5e combat state
→ player chooses legal supported move
→ initiative / attack / AC / damage / STAB / type math
→ HP + PP persisted
→ win / lose
→ authored return node
```

A save made during combat contains the battle round, initiative order, HP, PP, logs and current turn.

## Fidelity boundary

This milestone implements the authoritative **core attack/damage loop**.

It deliberately does not silently fake advanced mechanics that are not implemented yet. The next fidelity layer must add:

- move secondary effects such as burn, paralysis and flinch
- save-based moves and Move DC
- status conditions
- abilities such as Intimidate / Flash Fire / Torrent
- action vs bonus-action timing
- movement, range and positioning
- reactions and attacks of opportunity
- switching and multi-Pokémon battles
- items, capture and trainer actions
- full local species/move pack

Until those are implemented, the combat UI exposes only locally supported attack-roll action moves.

## Next engineering gate

Expand the combat rules layer from the validated core into a complete 2024 move/status/ability resolver while preserving:

1. deterministic tests,
2. offline operation,
3. engine-owned truth,
4. save/resume at any point.

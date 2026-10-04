# Vertical Slice 01 — Offline Bookgame Runtime

## Implemented

This slice proves the first executable Bookgame loop without ChatGPT, network access or third-party packages.

- New Game
- protagonist selection from the five inherited rookie builds
- one authored Asteria location
- one authored wild-Pokémon scene
- contextual choices
- WIS / Animal Handling d20 check
- deterministic success and failure branches
- durable world flag changes
- explicit Pokémon 5e combat handoff
- return path from combat resolver to authored story
- atomic local JSON save
- reload from exact saved node
- terminal UI

## Run locally

Requires Node.js 20+.

```bash
cd bookgame
npm test
npm run play
```

No `npm install` is required because the slice has no runtime or test dependencies.

## Current combat boundary

The Bookgame runtime deliberately does **not** fake Pokémon 5e combat.

When an authored choice starts combat, it emits a structured pending handoff:

```json
{
  "type": "pokemon5e_combat",
  "authority": "pokemon5e_rules",
  "status": "awaiting_resolution"
}
```

A later combat adapter/resolver will consume that object and return an authored outcome key such as `win`, `lose` or `fled`.

This preserves the architectural rule:

**written narration describes truth; it does not create mechanical truth.**

## Next engineering gate

The next slice should connect a real local Pokémon 5e combat resolver to this handoff while preserving deterministic tests and offline operation.

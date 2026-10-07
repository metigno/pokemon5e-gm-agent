# UI Vertical Slice V1

First real graphical UI slice for the Pokémon 5e Digital Bookgame, now aligned to the canonical runtime.

## Canonical entry
A fresh game starts at `intro-m01#trainer_specialization`, completes Pokémon 5e Trainer creation, then reaches M1 only after tutorial completion or an explicit tutorial skip.

## Runtime ownership
The UI uses:
- `BookgameEngine` for story, checks, conditions and effects;
- `SaveStore` for persistence;
- `Pokemon5eCombatEngine` for battle resolution;
- canonical authored scenes under `bookgame/content/scenes/`.

## Run
From `bookgame/`:

```bash
npm run ui
```

Open `http://127.0.0.1:4173`.

## Progressive text — LOCKED
- Normal: 32 ms/character.
- Additional punctuation pauses.
- Tap/click or “Mostra tutto” completes the current reveal.
- Choices remain hidden until reveal completes.
- Lenta / Normale / Veloce / Istantanea.
- `prefers-reduced-motion` forces instant mode.

## Included surfaces
- canonical Intro/M1 Story Screen;
- Trainer drawer;
- Pokémon/Team drawer;
- Inventory drawer;
- Journal drawer;
- Settings;
- New Game / Continue;
- autosave after choices and battle actions;
- battle screen backed by the Pokémon 5e resolver;
- forced switch when required;
- automatic return to authored narrative after battle outcome.

## Boundary
The vertical slice is a presentation layer, not a second rules engine. Hidden DCs and internal engine identifiers are not player-facing.

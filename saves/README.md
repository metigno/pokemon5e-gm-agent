# Save Slots

This project has exactly **5 independent campaign save slots**.

- `saves/slot1/`
- `saves/slot2/`
- `saves/slot3/`
- `saves/slot4/`
- `saves/slot5/`

Each slot contains:
- `campaign.json` — authoritative mechanical/durable state;
- `session-log.md` — chronological factual checkpoint log.

## Safety rule

There is **no repository-wide active slot**.

A ChatGPT session must know which slot it is operating on before it writes campaign state.

This prevents two players using the same repository from accidentally overwriting each other's campaigns.

If the player says:
- "gioca slot 1" → use only `saves/slot1/`;
- "continua slot 3" → use only `saves/slot3/`;
- "nuova partita slot 5" → reset/use only `saves/slot5/`.

If no slot is known, show the five slots and ask which one to use before starting/resuming play.

## New game

An empty slot already contains the common campaign premise and protagonist-selection state.

The slot becomes occupied when a protagonist is selected and the opening campaign state is checkpointed.

## Multiplayer / friends

Different people may use different slots.

Example:
- Slot 1 — Luca
- Slot 2 — Marco
- Slot 3 — another friend

Their timelines, captures, deaths, NPC relationships, teams and World Championship outcomes remain independent.

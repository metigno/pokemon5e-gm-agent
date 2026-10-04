# Checkpoint Policy

Each save slot has its own `checkpoints.json`.

Git history is the true snapshot history; this ledger is the readable index.

## Automatic checkpoint classes

- **CP-LEVEL** — after every Trainer Level increase.
- **CP-PRE-ANCHOR** — before a stable high-stakes HARD_ANCHOR/COMPETITIVE_GATE.
- **CP-POST-ANCHOR** — after resolution, failure or expiration.
- **CP-CHAIN** — after a major scripted-chain stage.
- **CP-WORLD** — after an off-screen world event creates a durable relevant consequence.
- **CP-DEATH** — immediately after irreversible death/equivalent loss.
- **CP-RANK-PRE** — immediately before a Promotion Trial attempt.
- **CP-RANK-POST** — after a Promotion Trial win; also after a loss when the attempt creates a durable consequence.

High-stakes events should normally have PRE and POST checkpoints.

Ordinary exploration does not need a save after every action.

## Commit naming

Use the selected slot and checkpoint ID in the Git commit message.

Example: `save(slot2): CP-WORLD-GROUP2 post-match`

## Ledger entry

Record:
- `id`
- `event_id`
- `world_day`
- `trainer_level`
- `location`
- `type`
- `result`
- short factual `summary`

Do not place hidden spoilers in player-visible checkpoint summaries.


## Rank checkpoint fields

Record current rank, target rank, Promotion Trial ID, attempt number, battle result, new rank when promoted and the newly unlocked access band. A lost trial never records the target rank as unlocked.

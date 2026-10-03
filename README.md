# Pokémon 5e GM Agent

Persistent LLM Game Master for Pokémon 5e, backed by GitHub state and powered by the LEGA GPT v14.1 tactical engine.

This project is completely separate from Pokémon Sports Career (PSC).

## Architecture

Pokémon 5e rules + campaign state
→ legal actions
→ LEGA GPT v14.1 tactical reasoning
→ chosen legal action
→ Pokémon 5e dice/mechanical resolution
→ GitHub checkpoint

## Motor-stat bridge

The LEGA GPT motor exposes eight trainer stats from 1–20. This project converts them into playable tabletop data without replacing Pokémon 5e rules.

- Motor scores keep their original 1–20 values.
- Modifier: `floor((score - 10) / 2)`.
- Missing NPC sheets may project INT/WIS/CHA and a bounded DEX from the motor profile.
- STR and CON stay physical and are never inferred from tactical intelligence.
- Behavior Profile values (0–1) remain AI preferences, never dice bonuses.
- Existing player/NPC 5e abilities are never overwritten.

See `runtime/STAT_CONVERSION.md`.

## Source of truth

1. Campaign house rules in state.
2. Pokémon 5e selected edition (default 2024).
3. Official `Auroratide/poke5e` source.
4. D&D 5e baseline where Pokémon 5e does not replace it.
5. Minimal GM ruling for genuinely undefined cases.

LEGA GPT v14.1 chooses tactically. Pokémon 5e resolves mechanically.

## Core files

- `AGENT.md`
- `BOOT.md`
- `rules/sources.yaml`
- `state/campaign.json`
- `state/session-log.md`
- `runtime/runtime-manifest.json`
- `runtime/STAT_CONVERSION.md`
- `src/bridge/motor-to-poke5e.mjs`
- `tests/motor-to-poke5e.test.mjs`

Run conversion tests with `npm test`.

Pokémon 5e rules: https://poke5e.app/rules
Official source: https://github.com/Auroratide/poke5e

# Pokémon 5e GM Agent

Persistent LLM Game Master for Pokémon 5e, backed by GitHub state and powered by the LEGA GPT v14.1 tactical engine.

This project is completely separate from Pokémon Sports Career (PSC).

## Campaign

The campaign is now initialized as **Road to the World Championships**.

The player chooses one of five protagonists:
Luke / Edward / Fab / Daniel / Mattew.

Their fixed starters are stored in `campaign/PROTAGONIST_SELECTION.md`.

The four non-player protagonists follow their established 2060 canon careers. Future rosters, legendary arcs and World Championship anchors are kept in the GM-private canon ledger and must not be revealed before in-world discovery.

## Stats

The old eight LEGA GPT Player Stats are no longer playable parallel stats.

They have been converted into classic D&D/Pokémon 5e:
**STR / DEX / CON / INT / WIS / CHA**.

All checks now use real Pokémon 5e/D&D abilities and skills. The old stat names survive only as migration intent so the GM knows which normal check replaces them.

Example: old **Mind Games** → **INT-based** check, normally Investigation, or INT with Intimidation/Performance when the established proficiency and approach fit.

See `runtime/STAT_CONVERSION.md`.

## Architecture

Pokémon 5e rules + campaign state
→ legal actions
→ LEGA GPT v14.1 tactical reasoning
→ chosen legal action
→ Pokémon 5e dice/mechanical resolution
→ GitHub checkpoint

## Source of truth

1. Campaign house rules.
2. Pokémon 5e selected edition (2024 default).
3. Official `Auroratide/poke5e` source.
4. D&D 5e baseline.
5. Minimal GM ruling.

LEGA GPT v14.1 chooses tactically. Pokémon 5e resolves mechanically.

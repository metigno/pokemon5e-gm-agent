# Pokémon 5e GM Agent

Persistent LLM Game Master for a full Pokémon journey played with Pokémon 5e rules, backed by GitHub state and assisted by the LEGA GPT v14.1 tactical engine.

This project is completely separate from Pokémon Sports Career (PSC).

## Campaign premise

Five friends begin their careers together and receive their first Pokémon at the same opening event.

- Luke — Hisuian Growlithe Lv. 5
- Mattew — Eevee Lv. 5
- Daniel — Gastly Lv. 5
- Edward — Totodile Lv. 5
- Fab — Koffing Lv. 5

All five begin as Trainer Level 1.

The user selects one as the player character. The other four become persistent autonomous NPCs who continue their own journeys off-screen and can later reappear as allies, rivals, opponents or companions.

After the opening, the campaign runs as a classic Pokémon adventure using Pokémon 5e tabletop rules: travel, wild encounters, catches, towns, quests, trainers, regional conflicts, competitions, recurring rivals and eventual access to the international circuit.

The World Championship is the long-term competitive objective, not a predetermined ending. The player can qualify, fail to qualify, win, lose, change direction or die before reaching it.

## Character canon

`Roster2060(1).md` has been distilled into:

- `canon/FRIENDS_CHARACTER_SEEDS.md`
- `canon/ROSTER2060_CHARACTER_BIBLE.json`

The source is used for personality, flaws, tactical identity, behavioral tendencies and lore continuity.

For Luke, Mattew, Daniel, Edward and Fab, the 2060 material is a **future-character trajectory**, not history that has already happened before the campaign.

For the four unchosen friends, future roster/legendary material is a hidden NPC trajectory that the GM may naturally converge toward only if the character remains alive and campaign causality does not meaningfully divert them.

The selected player is never forced toward a predetermined final roster or championship result.

## Balanced starting stats

All five begin with the same D&D standard-array budget:

`15 / 14 / 13 / 12 / 10 / 8`

They have different distributions based on personality, but equal starting power.

The old LEGA GPT Player Stats are not a parallel roll system. They are late-career characterization signals only.

All checks use normal Pokémon 5e / D&D abilities and skills:

**STR / DEX / CON / INT / WIS / CHA**

Examples:
- Mind Games → INT-based check
- Strategia → INT / Investigation
- Prediction → WIS / Insight or Perception
- Gestione Team → CHA / Animal Handling or Persuasion

See `runtime/STAT_CONVERSION.md`.

## Player vs NPC progression

The selected player uses normal Pokémon 5e progression and chooses their own legal character growth.

The four unchosen friends use NPC-only scripted ASI milestones through ordinary D&D/Pokémon 5e ability increases. Those scripts are trajectory tools, not plot armor, and can be altered by genuine campaign events.

## Tactical architecture

```
Pokémon 5e rules + campaign state
            ↓
       legal actions
            ↓
 LEGA GPT v14.1 tactical reasoning
            ↓
      chosen legal action
            ↓
 Pokémon 5e dice + mechanical resolution
            ↓
      GitHub checkpoint
```

LEGA GPT v14.1 improves NPC tactical decision quality. Pokémon 5e remains authoritative for legality, dice, AC, damage, HP, PP, conditions, movement, switching, captures, progression and death.

## Important files

- `AGENT.md` — GM operating contract
- `BOOT.md` — load instructions
- `campaign/PREMISE.md` — campaign structure
- `campaign/PROTAGONIST_SELECTION.md` — five starting choices
- `canon/FRIENDS_CHARACTER_SEEDS.md` — rookie personalities
- `canon/ROSTER2060_CHARACTER_BIBLE.json` — NPC character bible
- `state/campaign.json` — durable campaign state
- `state/session-log.md` — campaign checkpoints
- `runtime/STAT_CONVERSION.md` — balanced D&D stat model
- `src/bridge/motor-to-poke5e.mjs` — executable stat/progression bridge

## Repository

`metigno/pokemon5e-gm-agent`

Default branch: `main`


## Save system

The GM supports **5 independent save slots** under `saves/`. Each slot has its own campaign state and session log. Slot selection is per-chat, so multiple players can safely use different slots without sharing progress. See `saves/README.md`.


## Scripted world / Event Director

The long campaign uses an open-world Event Director.

Free exploration remains free, but the world contains anchors triggered by Trainer Level, completed chains, badges, time, location, NPC state, ranking and deadlines.

Some things happen even when the player ignores them; their outcomes are never predetermined.

The first hard-scripted chain is `INTRO_FIVE`, shared by every protagonist.

See `campaign/events/`.


## Human-GM presentation

The GM wraps exact Pokémon 5e mechanics in tabletop narration using **fiction → mechanics → fiction**.

Combat includes movement, impacts, positioning and visible reactions while still showing rolls, HP changes and conditions. The same applies to checks, captures, travel, shops, healing, evolution, level-ups and scripted events.

Routine actions stay concise; major moments receive richer narration.

See `campaign/GM_NARRATION_STYLE.md`.


## Asteria — living world

The campaign starts in the **Territorio Interregionale di Asteria**.

Asteria has a persistent topological map, cities, districts, routes, transport, ecology, jobs, factions, news, schedules and off-screen NPC activity.

The first city is **Valedarsena**, a dense estuary/rail hub rather than a one-screen service town.

Each save slot has its own `world-state.json`, so two players can permanently change the world in different ways.

See `campaign/world/`.

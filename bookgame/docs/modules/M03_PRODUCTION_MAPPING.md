# P5E LIBROGAME — M03 PRODUCTION MAPPING

**Module:** M03 — Ferro, Polvere e Pressione  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M03_FERRO_POLVERE_E_PRESSIONE_MODULE_DESIGN.md`  
**Purpose:** production map for converting M3 into validated offline story content  
**Locked authored budget:** **6,000 stitches / 3,900 player choices**

**Module implementation status:** **MAPPED / NOT YET PRODUCTION-COMPLETE**

E1–E7 are reusable infrastructure from M1. A block may extend generic data or content, but must not fork those engines into module-specific substitutes.

---

# 1. MACRO GRAPH

```text
M3_00_RANK_D_HANDOFF
   ↓
M3_01_CAVA_GRIGIA
   ↓
M3_02_FERRAVIA_ARRIVAL
   ↓
M3_03_OLD_MAPS
   ↓
M3_04_STEVEN_ENTERS
   ↓
M3_05_TUNNEL_WARNINGS
   ↓
M3_06_FERROX_INCIDENT
   ↓
M3_07_FERROX_RESCUE
   ↓
M3_08_FRIEND_BEAT_03
   ↓
M3_09_CROSSROADS
   ↓
M3_10_REGIONAL_CUP
   ↓
M3_11_RESCUE_OUTCOME
   ↓
M3_12_TRIAL_REGISTRATION
   ↓
M3_13_PROMOTION_TRIAL_D_C
   ↓
M3_14_TRIAL_RESULT
```

This is a production ordering spine, not a forced linear playthrough. Free exploration, world progression, optional content and legal postponement can reconnect between blocks.

---

# 2. BUDGET MAP

| Block | Function | Stitches | Choices | Current state |
|---|---|---:|---:|---|
| M3_00_RANK_D_HANDOFF | portare avanti mondo, roster, relazioni e conseguenze M2 | 290 | 189 | PLANNED |
| M3_01_CAVA_GRIGIA | aprire paesaggio industriale, lavoro e fauna di cava | 342 | 222 | PLANNED |
| M3_02_FERRAVIA_ARRIVAL | hub ferroviario/officina, servizi e Arena | 342 | 222 | PLANNED |
| M3_03_OLD_MAPS | rendere leggibili segnali tecnici e mappe incomplete | 342 | 222 | PLANNED |
| M3_04_STEVEN_ENTERS | introduzione di Steven come osservatore tecnico, non boss | 342 | 222 | PLANNED |
| M3_05_TUNNEL_WARNINGS | accumulare segnali di rischio senza imporre una sola interpretazione | 342 | 222 | PLANNED |
| M3_06_FERROX_INCIDENT | attivare l'incidente e i suoi timer reali | 342 | 222 | PLANNED |
| M3_07_FERROX_RESCUE | soccorso con scelte di rischio, tempo e risorse | 496 | 323 | PLANNED |
| M3_08_FRIEND_BEAT_03 | A3_FRIEND_CALL con uno dei Four causalmente disponibile | 496 | 323 | PLANNED |
| M3_09_CROSSROADS | A3_CROSSROADS: priorità incompatibili e conseguenze | 342 | 222 | PLANNED |
| M3_10_REGIONAL_CUP | competizione opzionale con bracket e risultati emergenti | 496 | 322 | PLANNED |
| M3_11_RESCUE_OUTCOME | persistenza di vittime, danni, reputazione e responsabilità | 444 | 289 | PLANNED |
| M3_12_TRIAL_REGISTRATION | eligibility D→C a Ferravia | 444 | 289 | PLANNED |
| M3_13_PROMOTION_TRIAL_D_C | checkpoint RANK_D_TO_C con roster ufficiale 3 | 496 | 322 | PLANNED |
| M3_14_TRIAL_RESULT | loss/retry o Rank C e handoff verso M4 | 444 | 289 | PLANNED |
| **TOTAL** |  | **6,000** | **3,900** | |

Budgets are authored surface capacity. One run sees only the paths made legal by its state.

---

# 3. CANONICAL EVENT BINDINGS

- `A3_FRIEND_CALL`
- `A3_RANK_TRIAL_D_C`
- `A3_CROSSROADS`
- `A3_REGIONAL_CUP`

Bindings must call the existing event/competition state. Do not create look-alike quest flags for Rank, brackets, qualification or World results.

---

# 4. ENGINE REUSE CONTRACT

- **E1 Conditions:** reuse for rank, roster, relationship, world and bracket prerequisites.
- **E2 Time/Calendar:** reuse for travel, deadlines, service hours, recovery and event windows.
- **E3 Quest State:** reuse for active/completed/failed/ignored/expired content.
- **E4 NPC/Relationships:** reuse for Anchor/Four schedules, relationship state and encounter plausibility.
- **E5 Competition:** reuse for official matches, trials, cups, qualifier and World stages.
- **E6 Living World:** reuse for off-screen progress, unresolved problems and independent NPC careers.
- **E7 Ecology:** reuse for biome/time/method encounter selection and fauna state.

A content gap is not permission to implement a second engine.

---

# 5. BLOCK CONTRACTS

## M3_00_RANK_D_HANDOFF

**Purpose:** portare avanti mondo, roster, relazioni e conseguenze M2.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M3_01_CAVA_GRIGIA

**Purpose:** aprire paesaggio industriale, lavoro e fauna di cava.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M3_02_FERRAVIA_ARRIVAL

**Purpose:** hub ferroviario/officina, servizi e Arena.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M3_03_OLD_MAPS

**Purpose:** rendere leggibili segnali tecnici e mappe incomplete.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M3_04_STEVEN_ENTERS

**Purpose:** introduzione di Steven come osservatore tecnico, non boss.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M3_05_TUNNEL_WARNINGS

**Purpose:** accumulare segnali di rischio senza imporre una sola interpretazione.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M3_06_FERROX_INCIDENT

**Purpose:** attivare l'incidente e i suoi timer reali.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M3_07_FERROX_RESCUE

**Purpose:** soccorso con scelte di rischio, tempo e risorse.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M3_08_FRIEND_BEAT_03

**Purpose:** A3_FRIEND_CALL con uno dei Four causalmente disponibile.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M3_09_CROSSROADS

**Purpose:** A3_CROSSROADS: priorità incompatibili e conseguenze.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M3_10_REGIONAL_CUP

**Purpose:** competizione opzionale con bracket e risultati emergenti.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M3_11_RESCUE_OUTCOME

**Purpose:** persistenza di vittime, danni, reputazione e responsabilità.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M3_12_TRIAL_REGISTRATION

**Purpose:** eligibility D→C a Ferravia.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M3_13_PROMOTION_TRIAL_D_C

**Purpose:** checkpoint RANK_D_TO_C con roster ufficiale 3.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M3_14_TRIAL_RESULT

**Purpose:** loss/retry o Rank C e handoff verso M4.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


# 6. STATE OWNERSHIP

Primary state families:

- `m3_complete`;
- Anchor state for Steven Stone;
- `friend_beat_03_*`;
- module-specific conflict/outcome state;
- canonical competition history for events listed above;
- next-module unlock state.

Structured Pokémon/team/player state remains owned by the engine.

---

# 7. CALLBACK MATRIX

Required callback classes:

| Source | M3 behavior | Future behavior |
|---|---|---|
| prior conflict outcomes | alter context, reputation, access or information when relevant | remain persistent; never rewritten into a canonical choice |
| prior Friend Beats | influence relationship/schedule selection | rotation and callbacks continue |
| prior official results | appear in history/reputation where causal | never grant Rank by narration |
| ignored/failed quests | world may have resolved or worsened them | no frozen quest assumption |
| Anchor encounters | preserve relationship/result/schedule | eligible for later World/postgame callback |
| M3 Friend Beat | persist selected friend/type/result | later modules can reference it |

---

# 8. REGRESSION FAMILIES

At minimum validate:

- entry from the weakest legal prior-module state;
- entry from a heavily explored prior-module state;
- Anchor encountered and Anchor not yet encounterable where optional;
- at least two different eligible friends for FRIEND_BEAT;
- relevant competition win/loss/elimination branches;
- ignoring the main conflict long enough for E6 progression;
- optional competition skipped where legal;
- save/reload after each durable resolution;
- repeated scene entry does not duplicate rewards/results;
- exit contract cannot be forced through hidden choices;
- no state reset at module boundary.

---

# 9. EXIT CONTRACT

- `current_rank=C`;
- `steven_met=true`;
- `friend_beat_03_complete=true`;
- `ferrox_rescue_state persistente`;
- `regional_cup_result registrato se disputato`;
- `m04_unlocked=true`;

The next module unlock is a consequence of the canonical state, not a narrative teleport.

---

# 10. PRODUCTION ORDER

1. lock location/event/state reads;
2. author open exploration and world-pressure blocks;
3. wire Anchor and FRIEND_BEAT variants;
4. wire optional competition;
5. wire mandatory gate/World stage when applicable;
6. add save/reload and idempotence tests;
7. run cross-module regression from at least two distinct prior histories;
8. mark individual blocks COMPLETE only after runtime evidence.

---

# 11. PRODUCTION RULE

Do not pad the budget. Every stitch must establish place/character/world state, provide information, react to prior state, resolve consequence, support meaningful choice, or create a callback. Every counted choice must change route, information, time, risk, relationship, state, combat/encounter state or future access.

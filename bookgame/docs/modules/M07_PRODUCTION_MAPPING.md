# P5E LIBROGAME — M07 PRODUCTION MAPPING

**Module:** M07 — Sotto i Riflettori  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M07_SOTTO_I_RIFLETTORI_MODULE_DESIGN.md`  
**Purpose:** production map for converting M7 into validated offline story content  
**Locked authored budget:** **5,200 stitches / 3,200 player choices**

**Module implementation status:** **MAPPED / NOT YET PRODUCTION-COMPLETE**

E1–E7 are reusable infrastructure from M1. A block may extend generic data or content, but must not fork those engines into module-specific substitutes.

---

# 1. MACRO GRAPH

```text
M7_00_RANK_S_HANDOFF
   ↓
M7_01_MERIDIANA_ARRIVAL
   ↓
M7_02_CYNTHIA_ENTERS
   ↓
M7_03_MEDIA_SPONSOR
   ↓
M7_04_PRO_PREPARATION
   ↓
M7_05_FRIEND_BEAT_07
   ↓
M7_06_QUALIFIER_REGISTRATION
   ↓
M7_07_WORLD_QUALIFIER
   ↓
M7_08_QUALIFIER_RESULT
   ↓
M7_09_LAST_CHANCE_GATE
   ↓
M7_10_LAST_CHANCE
   ↓
M7_11_BEFORE_THE_LIGHTS
   ↓
M7_12_WORLDS_MISSED
   ↓
M7_13_MODULE_OUTCOME
```

This is a production ordering spine, not a forced linear playthrough. Free exploration, world progression, optional content and legal postponement can reconnect between blocks.

---

# 2. BUDGET MAP

| Block | Function | Stitches | Choices | Current state |
|---|---|---:|---:|---|
| M7_00_RANK_S_HANDOFF | ingresso nella fascia Candidate Mondiale senza auto-qualificazione | 294 | 181 | PLANNED |
| M7_01_MERIDIANA_ARRIVAL | Grand Hall, servizi pro, medicina e stazione internazionale | 346 | 213 | PLANNED |
| M7_02_CYNTHIA_ENTERS | introduzione di Cynthia come peer/benchmark, non boss | 346 | 213 | PLANNED |
| M7_03_MEDIA_SPONSOR | pressione pubblica e contratti senza bonus meccanici illegali | 346 | 213 | PLANNED |
| M7_04_PRO_PREPARATION | training, scouting e gestione squadra con regole reali | 294 | 181 | PLANNED |
| M7_05_FRIEND_BEAT_07 | uno dei Four nella corsa al Mondiale in stato reale | 501 | 308 | PLANNED |
| M7_06_QUALIFIER_REGISTRATION | eligibility WORLD_QUALIFIER e roster ufficiale 6 | 449 | 276 | PLANNED |
| M7_07_WORLD_QUALIFIER | bracket reale; solo risultato effettivo può qualificare | 501 | 308 | PLANNED |
| M7_08_QUALIFIER_RESULT | qualificato o eliminato, history e conseguenze | 449 | 276 | PLANNED |
| M7_09_LAST_CHANCE_GATE | accesso solo se last_chance_eligible | 345 | 213 | PLANNED |
| M7_10_LAST_CHANCE | route finita, nessun retry infinito | 345 | 213 | PLANNED |
| M7_11_BEFORE_THE_LIGHTS | A7_BEFORE_LIGHTS per qualificati e amici disponibili | 345 | 212 | PLANNED |
| M7_12_WORLDS_MISSED | ramo completo per chi non si qualifica | 345 | 212 | PLANNED |
| M7_13_MODULE_OUTCOME | handoff M8 o WORLD_EXIT/M12 senza falsificare esiti | 294 | 181 | PLANNED |
| **TOTAL** |  | **5,200** | **3,200** | |

Budgets are authored surface capacity. One run sees only the paths made legal by its state.

---

# 3. CANONICAL EVENT BINDINGS

- `A7_WORLD_QUALIFIER`
- `A7_LAST_CHANCE`
- `A7_BEFORE_LIGHTS`

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

## M7_00_RANK_S_HANDOFF

**Purpose:** ingresso nella fascia Candidate Mondiale senza auto-qualificazione.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M7_01_MERIDIANA_ARRIVAL

**Purpose:** Grand Hall, servizi pro, medicina e stazione internazionale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M7_02_CYNTHIA_ENTERS

**Purpose:** introduzione di Cynthia come peer/benchmark, non boss.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M7_03_MEDIA_SPONSOR

**Purpose:** pressione pubblica e contratti senza bonus meccanici illegali.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M7_04_PRO_PREPARATION

**Purpose:** training, scouting e gestione squadra con regole reali.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M7_05_FRIEND_BEAT_07

**Purpose:** uno dei Four nella corsa al Mondiale in stato reale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M7_06_QUALIFIER_REGISTRATION

**Purpose:** eligibility WORLD_QUALIFIER e roster ufficiale 6.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M7_07_WORLD_QUALIFIER

**Purpose:** bracket reale; solo risultato effettivo può qualificare.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M7_08_QUALIFIER_RESULT

**Purpose:** qualificato o eliminato, history e conseguenze.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M7_09_LAST_CHANCE_GATE

**Purpose:** accesso solo se last_chance_eligible.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M7_10_LAST_CHANCE

**Purpose:** route finita, nessun retry infinito.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M7_11_BEFORE_THE_LIGHTS

**Purpose:** A7_BEFORE_LIGHTS per qualificati e amici disponibili.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M7_12_WORLDS_MISSED

**Purpose:** ramo completo per chi non si qualifica.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M7_13_MODULE_OUTCOME

**Purpose:** handoff M8 o WORLD_EXIT/M12 senza falsificare esiti.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


# 6. STATE OWNERSHIP

Primary state families:

- `m7_complete`;
- Anchor state for Cynthia;
- `friend_beat_07_*`;
- module-specific conflict/outcome state;
- canonical competition history for events listed above;
- next-module unlock state.

Structured Pokémon/team/player state remains owned by the engine.

---

# 7. CALLBACK MATRIX

Required callback classes:

| Source | M7 behavior | Future behavior |
|---|---|---|
| prior conflict outcomes | alter context, reputation, access or information when relevant | remain persistent; never rewritten into a canonical choice |
| prior Friend Beats | influence relationship/schedule selection | rotation and callbacks continue |
| prior official results | appear in history/reputation where causal | never grant Rank by narration |
| ignored/failed quests | world may have resolved or worsened them | no frozen quest assumption |
| Anchor encounters | preserve relationship/result/schedule | eligible for later World/postgame callback |
| M7 Friend Beat | persist selected friend/type/result | later modules can reference it |

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

- `cynthia_met=true`;
- `friend_beat_07_complete=true`;
- `world_qualified=true oppure worlds_missed=true`;
- `qualifier_history persistente`;
- `m08_unlocked solo se world_qualified`;
- `m12_unlocked se worlds_missed`;

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

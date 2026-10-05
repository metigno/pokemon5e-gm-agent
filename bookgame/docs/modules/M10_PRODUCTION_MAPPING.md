# P5E LIBROGAME — M10 PRODUCTION MAPPING

**Module:** M10 — Nessuna Seconda Possibilità  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M10_NESSUNA_SECONDA_POSSIBILITA_MODULE_DESIGN.md`  
**Purpose:** production map for converting M10 into validated offline story content  
**Locked authored budget:** **4,000 stitches / 2,000 player choices**

**Module implementation status:** **MAPPED / NOT YET PRODUCTION-COMPLETE**

E1–E7 are reusable infrastructure from M1. A block may extend generic data or content, but must not fork those engines into module-specific substitutes.

---

# 1. MACRO GRAPH

```text
M10_00_R16_BRACKET
   ↓
M10_01_SILAS_THREAD
   ↓
M10_02_R16_PREP
   ↓
M10_03_WORLD_R16
   ↓
M10_04_R16_AFTERMATH
   ↓
M10_05_FRIEND_BEAT_10
   ↓
M10_06_QF_PREP
   ↓
M10_07_WORLD_QF
   ↓
M10_08_QF_AFTERMATH
   ↓
M10_09_MODULE_OUTCOME
```

This is a production ordering spine, not a forced linear playthrough. Free exploration, world progression, optional content and legal postponement can reconnect between blocks.

---

# 2. BUDGET MAP

| Block | Function | Stitches | Choices | Current state |
|---|---|---:|---:|---|
| M10_00_R16_BRACKET | lock dell'avversario dagli incroci reali | 367 | 184 | PLANNED |
| M10_01_SILAS_THREAD | Silas compare solo dove il bracket o il venue lo rendono plausibile | 367 | 184 | PLANNED |
| M10_02_R16_PREP | preparazione senza reset di HP/condizioni non consentiti | 312 | 156 | PLANNED |
| M10_03_WORLD_R16 | ottavo reale, single elimination | 532 | 266 | PLANNED |
| M10_04_R16_AFTERMATH | eliminazione oppure avanzamento e risultati degli altri | 367 | 183 | PLANNED |
| M10_05_FRIEND_BEAT_10 | corsa dell'amico visibile; Player vs Friend solo se bracket | 532 | 266 | PLANNED |
| M10_06_QF_PREP | pressione Top8 e stato roster reale | 312 | 156 | PLANNED |
| M10_07_WORLD_QF | quarto reale, single elimination | 532 | 266 | PLANNED |
| M10_08_QF_AFTERMATH | eliminazione oppure Final Four | 367 | 183 | PLANNED |
| M10_09_MODULE_OUTCOME | handoff M11 o WORLD_EXIT | 312 | 156 | PLANNED |
| **TOTAL** |  | **4,000** | **2,000** | |

Budgets are authored surface capacity. One run sees only the paths made legal by its state.

---

# 3. CANONICAL EVENT BINDINGS

- `WORLD_R16`
- `WORLD_QF`

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

## M10_00_R16_BRACKET

**Purpose:** lock dell'avversario dagli incroci reali.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M10_01_SILAS_THREAD

**Purpose:** Silas compare solo dove il bracket o il venue lo rendono plausibile.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M10_02_R16_PREP

**Purpose:** preparazione senza reset di HP/condizioni non consentiti.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M10_03_WORLD_R16

**Purpose:** ottavo reale, single elimination.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M10_04_R16_AFTERMATH

**Purpose:** eliminazione oppure avanzamento e risultati degli altri.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M10_05_FRIEND_BEAT_10

**Purpose:** corsa dell'amico visibile; Player vs Friend solo se bracket.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M10_06_QF_PREP

**Purpose:** pressione Top8 e stato roster reale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M10_07_WORLD_QF

**Purpose:** quarto reale, single elimination.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M10_08_QF_AFTERMATH

**Purpose:** eliminazione oppure Final Four.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M10_09_MODULE_OUTCOME

**Purpose:** handoff M11 o WORLD_EXIT.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


# 6. STATE OWNERSHIP

Primary state families:

- `m10_complete`;
- Anchor state for Silas Crowe;
- `friend_beat_10_*`;
- module-specific conflict/outcome state;
- canonical competition history for events listed above;
- next-module unlock state.

Structured Pokémon/team/player state remains owned by the engine.

---

# 7. CALLBACK MATRIX

Required callback classes:

| Source | M10 behavior | Future behavior |
|---|---|---|
| prior conflict outcomes | alter context, reputation, access or information when relevant | remain persistent; never rewritten into a canonical choice |
| prior Friend Beats | influence relationship/schedule selection | rotation and callbacks continue |
| prior official results | appear in history/reputation where causal | never grant Rank by narration |
| ignored/failed quests | world may have resolved or worsened them | no frozen quest assumption |
| Anchor encounters | preserve relationship/result/schedule | eligible for later World/postgame callback |
| M10 Friend Beat | persist selected friend/type/result | later modules can reference it |

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

- `world_eliminated=true oppure world_qf_won=true`;
- `friend_beat_10_complete=true`;
- `actual bracket/history persistente`;
- `m11_unlocked se QF vinto`;
- `m12_unlocked se eliminato`;

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

# P5E LIBROGAME — M08 PRODUCTION MAPPING

**Module:** M08 — Il Mondo nello Stesso Posto  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M08_IL_MONDO_NELLO_STESSO_POSTO_MODULE_DESIGN.md`  
**Purpose:** production map for converting M8 into validated offline story content  
**Locked authored budget:** **4,400 stitches / 2,500 player choices**

**Module implementation status:** **MAPPED / NOT YET PRODUCTION-COMPLETE**

E1–E7 are reusable infrastructure from M1. A block may extend generic data or content, but must not fork those engines into module-specific substitutes.

---

# 1. MACRO GRAPH

```text
M8_00_WORLD_ARRIVAL
   ↓
M8_01_ACCREDITATION
   ↓
M8_02_MEDICAL_CONTROL
   ↓
M8_03_REGISTRATION
   ↓
M8_04_WORLD_VILLAGE
   ↓
M8_05_ASTRID_ENTERS
   ↓
M8_06_FRIEND_BEAT_08
   ↓
M8_07_TRAINING_HALL
   ↓
M8_08_MEDIA_DAY
   ↓
M8_09_OPENING_CEREMONY
   ↓
M8_10_WORLD_DRAW
   ↓
M8_11_GROUP_REVEAL
```

This is a production ordering spine, not a forced linear playthrough. Free exploration, world progression, optional content and legal postponement can reconnect between blocks.

---

# 2. BUDGET MAP

| Block | Function | Stitches | Choices | Current state |
|---|---|---:|---:|---|
| M8_00_WORLD_ARRIVAL | arrivo fisico e primo impatto con il venue | 478 | 272 | PLANNED |
| M8_01_ACCREDITATION | identità, accessi e timeline del torneo | 330 | 187 | PLANNED |
| M8_02_MEDICAL_CONTROL | controllo medico che legge lo stato reale senza heal narrativo | 330 | 187 | PLANNED |
| M8_03_REGISTRATION | roster World ufficiale e lock secondo regole | 280 | 159 | PLANNED |
| M8_04_WORLD_VILLAGE | vita nel Village e incontri causali | 478 | 272 | PLANNED |
| M8_05_ASTRID_ENTERS | campionessa in carica senza final-boss protection | 330 | 187 | PLANNED |
| M8_06_FRIEND_BEAT_08 | scena personale con amico qualificato o contatto esterno | 478 | 272 | PLANNED |
| M8_07_TRAINING_HALL | preparazione e sparring opzionale con stato reale | 329 | 187 | PLANNED |
| M8_08_MEDIA_DAY | interviste e reputazione senza imporre voce al player | 329 | 187 | PLANNED |
| M8_09_OPENING_CEREMONY | cerimonia, field e atmosfera senza falsi risultati | 280 | 159 | PLANNED |
| M8_10_WORLD_DRAW | generare field/gruppi dai 32 effettivi | 478 | 272 | PLANNED |
| M8_11_GROUP_REVEAL | lock avversari, calendario e handoff M9 | 280 | 159 | PLANNED |
| **TOTAL** |  | **4,400** | **2,500** | |

Budgets are authored surface capacity. One run sees only the paths made legal by its state.

---

# 3. CANONICAL EVENT BINDINGS

- `WORLD_DRAW`

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

## M8_00_WORLD_ARRIVAL

**Purpose:** arrivo fisico e primo impatto con il venue.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M8_01_ACCREDITATION

**Purpose:** identità, accessi e timeline del torneo.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M8_02_MEDICAL_CONTROL

**Purpose:** controllo medico che legge lo stato reale senza heal narrativo.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M8_03_REGISTRATION

**Purpose:** roster World ufficiale e lock secondo regole.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M8_04_WORLD_VILLAGE

**Purpose:** vita nel Village e incontri causali.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M8_05_ASTRID_ENTERS

**Purpose:** campionessa in carica senza final-boss protection.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M8_06_FRIEND_BEAT_08

**Purpose:** scena personale con amico qualificato o contatto esterno.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M8_07_TRAINING_HALL

**Purpose:** preparazione e sparring opzionale con stato reale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M8_08_MEDIA_DAY

**Purpose:** interviste e reputazione senza imporre voce al player.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M8_09_OPENING_CEREMONY

**Purpose:** cerimonia, field e atmosfera senza falsi risultati.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M8_10_WORLD_DRAW

**Purpose:** generare field/gruppi dai 32 effettivi.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M8_11_GROUP_REVEAL

**Purpose:** lock avversari, calendario e handoff M9.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


# 6. STATE OWNERSHIP

Primary state families:

- `m8_complete`;
- Anchor state for Astrid Vahl;
- `friend_beat_08_*`;
- module-specific conflict/outcome state;
- canonical competition history for events listed above;
- next-module unlock state.

Structured Pokémon/team/player state remains owned by the engine.

---

# 7. CALLBACK MATRIX

Required callback classes:

| Source | M8 behavior | Future behavior |
|---|---|---|
| prior conflict outcomes | alter context, reputation, access or information when relevant | remain persistent; never rewritten into a canonical choice |
| prior Friend Beats | influence relationship/schedule selection | rotation and callbacks continue |
| prior official results | appear in history/reputation where causal | never grant Rank by narration |
| ignored/failed quests | world may have resolved or worsened them | no frozen quest assumption |
| Anchor encounters | preserve relationship/result/schedule | eligible for later World/postgame callback |
| M8 Friend Beat | persist selected friend/type/result | later modules can reference it |

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

- `world_draw_complete=true`;
- `world_field_32_locked=true`;
- `player_group definito`;
- `tre avversari del player noti`;
- `friend_beat_08_complete=true`;
- `m09_unlocked=true`;

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

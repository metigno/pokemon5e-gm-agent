# P5E LIBROGAME — M05 PRODUCTION MAPPING

**Module:** M05 — Sopra le Nuvole  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M05_SOPRA_LE_NUVOLE_MODULE_DESIGN.md`  
**Purpose:** production map for converting M5 into validated offline story content  
**Locked authored budget:** **5,700 stitches / 3,600 player choices**

**Module implementation status:** **MAPPED / NOT YET PRODUCTION-COMPLETE**

E1–E7 are reusable infrastructure from M1. A block may extend generic data or content, but must not fork those engines into module-specific substitutes.

---

# 1. MACRO GRAPH

```text
M5_00_RANK_B_HANDOFF
   ↓
M5_01_MOUNTAIN_APPROACH
   ↓
M5_02_ALTACIMA
   ↓
M5_03_LANCE_ENTERS
   ↓
M5_04_WEATHER_DECISIONS
   ↓
M5_05_FULGORE_ASCENT
   ↓
M5_06_ANCIENT_TRACE
   ↓
M5_07_INTERREGIONAL_LICENSE
   ↓
M5_08_FIVE_CROSS_AGAIN
   ↓
M5_09_FRIEND_BEAT_05
   ↓
M5_10_HIGH_ALTITUDE_EVENT
   ↓
M5_11_TRIAL_REGISTRATION
   ↓
M5_12_PROMOTION_TRIAL_B_A
   ↓
M5_13_MASTERS_ENTRY
   ↓
M5_14_MODULE_OUTCOME
```

This is a production ordering spine, not a forced linear playthrough. Free exploration, world progression, optional content and legal postponement can reconnect between blocks.

---

# 2. BUDGET MAP

| Block | Function | Stitches | Choices | Current state |
|---|---|---:|---:|---|
| M5_00_RANK_B_HANDOFF | ereditare costa, circuiti e roster maturato | 308 | 194 | PLANNED |
| M5_01_MOUNTAIN_APPROACH | aprire Monti Ferrox con viaggio e rischio meteo | 362 | 229 | PLANNED |
| M5_02_ALTACIMA | hub di quota, medicina, logistica e Sala della Cresta | 362 | 229 | PLANNED |
| M5_03_LANCE_ENTERS | introduzione di Lance tramite carriera reale | 362 | 229 | PLANNED |
| M5_04_WEATHER_DECISIONS | finestre meteo, rinvio, deviazione e rischio | 362 | 229 | PLANNED |
| M5_05_FULGORE_ASCENT | accesso all'Altopiano Fulgore e pressione ambientale | 362 | 229 | PLANNED |
| M5_06_ANCIENT_TRACE | A5_TRACE: anomalia antica/meteorologica senza soluzione prematura | 362 | 229 | PLANNED |
| M5_07_INTERREGIONAL_LICENSE | A5_INTERREGIONAL e apertura di tratte più ampie | 362 | 229 | PLANNED |
| M5_08_FIVE_CROSS_AGAIN | A5_FIVE_CROSS: reunion causale dei Five | 362 | 228 | PLANNED |
| M5_09_FRIEND_BEAT_05 | beat personale obbligatorio dentro la reunion | 525 | 331 | PLANNED |
| M5_10_HIGH_ALTITUDE_EVENT | soccorso/competizione/lavoro ad alta quota con stato reale | 362 | 228 | PLANNED |
| M5_11_TRIAL_REGISTRATION | eligibility B→A ad Altacima | 470 | 297 | PLANNED |
| M5_12_PROMOTION_TRIAL_B_A | checkpoint RANK_B_TO_A, roster ufficiale 5 | 525 | 331 | PLANNED |
| M5_13_MASTERS_ENTRY | A5_MASTERS_ENTRY dopo Rank A, senza sostituire il gate | 307 | 194 | PLANNED |
| M5_14_MODULE_OUTCOME | Rank A, licenza interregionale e handoff M6 | 307 | 194 | PLANNED |
| **TOTAL** |  | **5,700** | **3,600** | |

Budgets are authored surface capacity. One run sees only the paths made legal by its state.

---

# 3. CANONICAL EVENT BINDINGS

- `A5_INTERREGIONAL`
- `A5_TRACE`
- `A5_FIVE_CROSS`
- `A5_RANK_TRIAL_B_A`
- `A5_MASTERS_ENTRY`

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

## M5_00_RANK_B_HANDOFF

**Purpose:** ereditare costa, circuiti e roster maturato.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M5_01_MOUNTAIN_APPROACH

**Purpose:** aprire Monti Ferrox con viaggio e rischio meteo.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M5_02_ALTACIMA

**Purpose:** hub di quota, medicina, logistica e Sala della Cresta.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M5_03_LANCE_ENTERS

**Purpose:** introduzione di Lance tramite carriera reale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M5_04_WEATHER_DECISIONS

**Purpose:** finestre meteo, rinvio, deviazione e rischio.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M5_05_FULGORE_ASCENT

**Purpose:** accesso all'Altopiano Fulgore e pressione ambientale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M5_06_ANCIENT_TRACE

**Purpose:** A5_TRACE: anomalia antica/meteorologica senza soluzione prematura.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M5_07_INTERREGIONAL_LICENSE

**Purpose:** A5_INTERREGIONAL e apertura di tratte più ampie.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M5_08_FIVE_CROSS_AGAIN

**Purpose:** A5_FIVE_CROSS: reunion causale dei Five.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M5_09_FRIEND_BEAT_05

**Purpose:** beat personale obbligatorio dentro la reunion.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M5_10_HIGH_ALTITUDE_EVENT

**Purpose:** soccorso/competizione/lavoro ad alta quota con stato reale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M5_11_TRIAL_REGISTRATION

**Purpose:** eligibility B→A ad Altacima.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M5_12_PROMOTION_TRIAL_B_A

**Purpose:** checkpoint RANK_B_TO_A, roster ufficiale 5.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M5_13_MASTERS_ENTRY

**Purpose:** A5_MASTERS_ENTRY dopo Rank A, senza sostituire il gate.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M5_14_MODULE_OUTCOME

**Purpose:** Rank A, licenza interregionale e handoff M6.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


# 6. STATE OWNERSHIP

Primary state families:

- `m5_complete`;
- Anchor state for Lance;
- `friend_beat_05_*`;
- module-specific conflict/outcome state;
- canonical competition history for events listed above;
- next-module unlock state.

Structured Pokémon/team/player state remains owned by the engine.

---

# 7. CALLBACK MATRIX

Required callback classes:

| Source | M5 behavior | Future behavior |
|---|---|---|
| prior conflict outcomes | alter context, reputation, access or information when relevant | remain persistent; never rewritten into a canonical choice |
| prior Friend Beats | influence relationship/schedule selection | rotation and callbacks continue |
| prior official results | appear in history/reputation where causal | never grant Rank by narration |
| ignored/failed quests | world may have resolved or worsened them | no frozen quest assumption |
| Anchor encounters | preserve relationship/result/schedule | eligible for later World/postgame callback |
| M5 Friend Beat | persist selected friend/type/result | later modules can reference it |

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

- `current_rank=A`;
- `lance_met=true`;
- `friend_beat_05_complete=true`;
- `interregional_license=true`;
- `ancient_mystery_layer_1 persistente`;
- `masters_entry disponibile o risolta`;
- `m06_unlocked=true`;

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

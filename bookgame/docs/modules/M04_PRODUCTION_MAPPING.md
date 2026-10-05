# P5E LIBROGAME — M04 PRODUCTION MAPPING

**Module:** M04 — Sale, Vento e Marea  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M04_SALE_VENTO_E_MAREA_MODULE_DESIGN.md`  
**Purpose:** production map for converting M4 into validated offline story content  
**Locked authored budget:** **5,900 stitches / 3,800 player choices**

**Module implementation status:** **MAPPED / NOT YET PRODUCTION-COMPLETE**

E1–E7 are reusable infrastructure from M1. A block may extend generic data or content, but must not fork those engines into module-specific substitutes.

---

# 1. MACRO GRAPH

```text
M4_00_RANK_C_HANDOFF
   ↓
M4_01_MAREASALE_ARRIVAL
   ↓
M4_02_WEATHER_WINDOW
   ↓
M4_03_ARCHIE_ENTERS
   ↓
M4_04_PORT_PRESSURE
   ↓
M4_05_COAST_ROUTE
   ↓
M4_06_REEF_ACCESS
   ↓
M4_07_SMUGGLING_THREAD
   ↓
M4_08_FRIEND_BEAT_04
   ↓
M4_09_LEAGUE_REGISTRATION
   ↓
M4_10_MAJOR_NAME
   ↓
M4_11_UPPER_REGIONAL
   ↓
M4_12_TRIAL_REGISTRATION
   ↓
M4_13_PROMOTION_TRIAL_C_B
   ↓
M4_14_AFTER_LEAGUE
```

This is a production ordering spine, not a forced linear playthrough. Free exploration, world progression, optional content and legal postponement can reconnect between blocks.

---

# 2. BUDGET MAP

| Block | Function | Stitches | Choices | Current state |
|---|---|---:|---:|---|
| M4_00_RANK_C_HANDOFF | ereditare Crossroads, Ferrox e Regional Cup | 307 | 198 | PLANNED |
| M4_01_MAREASALE_ARRIVAL | aprire porto, trasporti, Arena del Molo e nuove schedule | 361 | 233 | PLANNED |
| M4_02_WEATHER_WINDOW | meteo e partenze come vincoli reali di viaggio | 361 | 233 | PLANNED |
| M4_03_ARCHIE_ENTERS | introduzione causale di Archie e filosofia ocean-first | 361 | 233 | PLANNED |
| M4_04_PORT_PRESSURE | lavoro, merci, ritardi e primi segnali di contrabbando | 361 | 232 | PLANNED |
| M4_05_COAST_ROUTE | Costa di Sale come spazio esplorabile, non corridoio | 361 | 232 | PLANNED |
| M4_06_REEF_ACCESS | Barriera Azzurra, rischi marini e accesso contestuale | 361 | 232 | PLANNED |
| M4_07_SMUGGLING_THREAD | indagine/intervento/ignorare senza replica di M2 | 361 | 232 | PLANNED |
| M4_08_FRIEND_BEAT_04 | Friend on the Tide tramite schedule reale | 523 | 337 | PLANNED |
| M4_09_LEAGUE_REGISTRATION | A4_LEAGUE_REG e vincoli di calendario | 306 | 198 | PLANNED |
| M4_10_MAJOR_NAME | A4_MAJOR_NAME e apertura al wider world | 361 | 232 | PLANNED |
| M4_11_UPPER_REGIONAL | A4_REGIONAL_LEAGUE con risultati emergenti | 523 | 337 | PLANNED |
| M4_12_TRIAL_REGISTRATION | eligibility C→B all'Arena del Molo | 469 | 302 | PLANNED |
| M4_13_PROMOTION_TRIAL_C_B | checkpoint RANK_C_TO_B, roster ufficiale 4 | 523 | 337 | PLANNED |
| M4_14_AFTER_LEAGUE | A4_AFTER_LEAGUE, Rank B e conseguenze costiere | 361 | 232 | PLANNED |
| **TOTAL** |  | **5,900** | **3,800** | |

Budgets are authored surface capacity. One run sees only the paths made legal by its state.

---

# 3. CANONICAL EVENT BINDINGS

- `A4_LEAGUE_REG`
- `A4_MAJOR_NAME`
- `A4_RANK_TRIAL_C_B`
- `A4_REGIONAL_LEAGUE`
- `A4_AFTER_LEAGUE`

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

## M4_00_RANK_C_HANDOFF

**Purpose:** ereditare Crossroads, Ferrox e Regional Cup.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M4_01_MAREASALE_ARRIVAL

**Purpose:** aprire porto, trasporti, Arena del Molo e nuove schedule.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M4_02_WEATHER_WINDOW

**Purpose:** meteo e partenze come vincoli reali di viaggio.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M4_03_ARCHIE_ENTERS

**Purpose:** introduzione causale di Archie e filosofia ocean-first.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M4_04_PORT_PRESSURE

**Purpose:** lavoro, merci, ritardi e primi segnali di contrabbando.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M4_05_COAST_ROUTE

**Purpose:** Costa di Sale come spazio esplorabile, non corridoio.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M4_06_REEF_ACCESS

**Purpose:** Barriera Azzurra, rischi marini e accesso contestuale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M4_07_SMUGGLING_THREAD

**Purpose:** indagine/intervento/ignorare senza replica di M2.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M4_08_FRIEND_BEAT_04

**Purpose:** Friend on the Tide tramite schedule reale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M4_09_LEAGUE_REGISTRATION

**Purpose:** A4_LEAGUE_REG e vincoli di calendario.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M4_10_MAJOR_NAME

**Purpose:** A4_MAJOR_NAME e apertura al wider world.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M4_11_UPPER_REGIONAL

**Purpose:** A4_REGIONAL_LEAGUE con risultati emergenti.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M4_12_TRIAL_REGISTRATION

**Purpose:** eligibility C→B all'Arena del Molo.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M4_13_PROMOTION_TRIAL_C_B

**Purpose:** checkpoint RANK_C_TO_B, roster ufficiale 4.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M4_14_AFTER_LEAGUE

**Purpose:** A4_AFTER_LEAGUE, Rank B e conseguenze costiere.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


# 6. STATE OWNERSHIP

Primary state families:

- `m4_complete`;
- Anchor state for Archie;
- `friend_beat_04_*`;
- module-specific conflict/outcome state;
- canonical competition history for events listed above;
- next-module unlock state.

Structured Pokémon/team/player state remains owned by the engine.

---

# 7. CALLBACK MATRIX

Required callback classes:

| Source | M4 behavior | Future behavior |
|---|---|---|
| prior conflict outcomes | alter context, reputation, access or information when relevant | remain persistent; never rewritten into a canonical choice |
| prior Friend Beats | influence relationship/schedule selection | rotation and callbacks continue |
| prior official results | appear in history/reputation where causal | never grant Rank by narration |
| ignored/failed quests | world may have resolved or worsened them | no frozen quest assumption |
| Anchor encounters | preserve relationship/result/schedule | eligible for later World/postgame callback |
| M4 Friend Beat | persist selected friend/type/result | later modules can reference it |

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

- `current_rank=B`;
- `archie_met=true`;
- `friend_beat_04_complete=true`;
- `upper_regional_result persistente`;
- `smuggling_state persistente`;
- `m05_unlocked=true`;

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

# P5E LIBROGAME — M09 PRODUCTION MAPPING

**Module:** M09 — Tre Partite per Restare  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M09_TRE_PARTITE_PER_RESTARE_MODULE_DESIGN.md`  
**Purpose:** production map for converting M9 into validated offline story content  
**Locked authored budget:** **4,300 stitches / 2,300 player choices**

**Module implementation status:** **IN PROGRESS — M9_00–M9_04 COMPLETE / CYCLE 1 EXACT 77×170 / LIBRARY-V2 ALIGNED / E5 WORLD_GROUPS**

E1–E7 are reusable infrastructure from M1. A block may extend generic data or content, but must not fork those engines into module-specific substitutes.

---

# 1. MACRO GRAPH

```text
M9_00_GROUPS_OPEN
   ↓
M9_01_MATCHDAY_ONE
   ↓
M9_02_INTERDAY_ONE
   ↓
M9_03_KAIA_THREAD
   ↓
M9_04_MATCHDAY_TWO
   ↓
M9_05_FRIEND_BEAT_09
   ↓
M9_06_INTERDAY_TWO
   ↓
M9_07_MATCHDAY_THREE
   ↓
M9_08_GROUP_RESOLUTION
   ↓
M9_09_ELIMINATED_ROUTE
   ↓
M9_10_ADVANCE_ROUTE
```

This is a production ordering spine, not a forced linear playthrough. Free exploration, world progression, optional content and legal postponement can reconnect between blocks.

---

# 2. BUDGET MAP

| Block | Function | Stitches | Choices | Current state |
|---|---|---:|---:|---|
| M9_00_GROUPS_OPEN | presentazione gruppo e calendario immutabile | 289 | 154 | PLANNED |
| M9_01_MATCHDAY_ONE | primo match programmato con avversario reale | 493 | 264 | PLANNED |
| M9_02_INTERDAY_ONE | recovery, media e altri gruppi che continuano | 340 | 182 | PLANNED |
| M9_03_KAIA_THREAD | presenza di Kaia solo secondo draw/schedule reale | 340 | 182 | PLANNED |
| M9_04_MATCHDAY_TWO | secondo match e aggiornamento classifica | 493 | 264 | PLANNED |
| M9_05_FRIEND_BEAT_09 | match o interazione tra giornate secondo bracket reale | 493 | 263 | PLANNED |
| M9_06_INTERDAY_TWO | pressione classifica, condizioni e scenari senza outcome scripting | 340 | 182 | PLANNED |
| M9_07_MATCHDAY_THREE | terzo match programmato | 492 | 263 | PLANNED |
| M9_08_GROUP_RESOLUTION | tiebreak ufficiale, posizione finale e Top16 | 340 | 182 | PLANNED |
| M9_09_ELIMINATED_ROUTE | uscita coerente se non qualificato agli ottavi | 340 | 182 | PLANNED |
| M9_10_ADVANCE_ROUTE | handoff al bracket R16 se Top2 | 340 | 182 | PLANNED |
| **TOTAL** |  | **4,300** | **2,300** | |

Budgets are authored surface capacity. One run sees only the paths made legal by its state.

---

# 3. CANONICAL EVENT BINDINGS

- `WORLD_GROUPS`

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

## M9_00_GROUPS_OPEN

**Purpose:** presentazione gruppo e calendario immutabile.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M9_01_MATCHDAY_ONE

**Purpose:** primo match programmato con avversario reale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M9_02_INTERDAY_ONE

**Purpose:** recovery, media e altri gruppi che continuano.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M9_03_KAIA_THREAD

**Purpose:** presenza di Kaia solo secondo draw/schedule reale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M9_04_MATCHDAY_TWO

**Purpose:** secondo match e aggiornamento classifica.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M9_05_FRIEND_BEAT_09

**Purpose:** match o interazione tra giornate secondo bracket reale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M9_06_INTERDAY_TWO

**Purpose:** pressione classifica, condizioni e scenari senza outcome scripting.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M9_07_MATCHDAY_THREE

**Purpose:** terzo match programmato.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M9_08_GROUP_RESOLUTION

**Purpose:** tiebreak ufficiale, posizione finale e Top16.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M9_09_ELIMINATED_ROUTE

**Purpose:** uscita coerente se non qualificato agli ottavi.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M9_10_ADVANCE_ROUTE

**Purpose:** handoff al bracket R16 se Top2.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.



---

# 5A. CYCLE 1 IMPLEMENTATION LOCK — M9_00–M9_04

Cycle 1 converts the first five production blocks into runtime content while preserving the locked authored-surface manifest (**4,300 stitches / 2,300 choices**) and the module-wide logical trajectory (**~170 nodes / ~374 meaningful choices**).

**Cycle 1 logical surface:** **77 nodes / 170 meaningful choices** exactly.

## M9_00_GROUPS_OPEN

**Reuse class:** REUSE / ADAPT

**Source archetypes:**
- R21_MODULE_HANDOFF
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO
- R34_ACCESS_BOUNDARY_RECONNAISSANCE_GATE
- R33_CROSS_MODULE_CALLBACK
- R32_WAIT_LET_TIME_PASS

**Unique layer:** binds the already-locked M8 draw to the E5 `WORLD_GROUPS` runtime, creating a persistent three-match player schedule and a zero-point standings table without rerolling opponents.

**Implementation lock:** scene `m09-groups-open` contains **11 nodes / 25 meaningful choices**. The block opens group-stage state idempotently, never changes `competition.world.playerOpponents`, and keeps the M8 field/draw immutable.

## M9_01_MATCHDAY_ONE

**Reuse class:** ADAPT

**Source archetypes:**
- R15_FIRST_OFFICIAL_MATCH_LIFECYCLE
- R06_COMBAT_HANDOFF
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO
- R29_LIVING_WORLD_OFF_SCREEN_RESOLUTION
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** the official combat opponent is resolved dynamically from `competition.world.playerOpponents[0]`; E5 records the player result, deterministically resolves the other group match, recalculates provisional standings and rejects replay.

**Implementation lock:** scene `m09-matchday-one` contains **20 nodes / 43 meaningful choices**. No static opponent identity exists in authored combat content; six-Pokémon regulated runtime rosters are persisted under the E5 World group-stage state.

## M9_02_INTERDAY_ONE

**Reuse class:** REUSE / ADAPT

**Source archetypes:**
- R13_MEDICAL_POKEMON_CENTER_SERVICE
- R02_HUB_NAVIGATION
- R32_WAIT_LET_TIME_PASS
- R29_LIVING_WORLD_OFF_SCREEN_RESOLUTION
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** first World-group recovery window after a real Matchday result. Time can advance and the living tournament continues, but the scene never heals, rebuilds or resets the player roster by narration.

**Implementation lock:** scene `m09-interday-one` contains **13 nodes / 30 meaningful choices**. Medical/training/media routes are informational or time-consuming until the relevant existing subsystem is actually used.

## M9_03_KAIA_THREAD

**Reuse class:** ADAPT

**Source archetypes:**
- R23_NPC_PRESENCE_SCHEDULE_GATE
- R24_PERSISTENT_NPC_FIRST_MEETING
- R25_MULTI_CONTEXT_ANCHOR_INTRO
- R33_CROSS_MODULE_CALLBACK
- R29_LIVING_WORLD_OFF_SCREEN_RESOLUTION

**Unique layer:** Kaia Solari is registered by a Living World event only after Matchday 1 and only from her real World-qualified state. Physical contact requires schedule/location overlap; otherwise the player can only consume public tournament context.

**Implementation lock:** scene `m09-kaia-thread` contains **13 nodes / 29 meaningful choices**. Anchor status grants no result protection and never changes the group draw.

## M9_04_MATCHDAY_TWO

**Reuse class:** ADAPT

**Source archetypes:**
- R15_FIRST_OFFICIAL_MATCH_LIFECYCLE
- R06_COMBAT_HANDOFF
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO
- R29_LIVING_WORLD_OFF_SCREEN_RESOLUTION
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** the second official World group match consumes `competition.world.playerOpponents[1]` while preserving all Matchday 1 records, resources and standings history.

**Implementation lock:** scene `m09-matchday-two` contains **20 nodes / 43 meaningful choices**. E5 adds the second player result and the second off-screen group match exactly once; the third opponent remains unresolved for M9_07.

## Cycle 1 validation contract

- exact runtime budget: **77 nodes / 170 meaningful choices**;
- all authored Cycle-1 nodes reachable;
- no zero-incoming padding nodes;
- M8 draw remains immutable;
- Matchday 1 = locked opponent index 0;
- Matchday 2 = locked opponent index 1;
- official match replay is rejected/hidden after resolution;
- each Matchday resolves exactly one other group match off-screen through E5;
- provisional standings are derived from structured results, never authored flags;
- Interday 1 does not heal or rebuild the roster;
- Kaia physical contact requires E4 schedule/location overlap;
- save/reload preserves draw, group schedule, results, standings and Anchor schedule.

**No R39 candidate is required.** The only new work is an E5 World-group state extension plus UNIQUE M9 content composed from Library V2 R01→R38 primitives.


# 6. STATE OWNERSHIP

Primary state families:

- `m9_complete`;
- Anchor state for Kaia Solari;
- `friend_beat_09_*`;
- module-specific conflict/outcome state;
- canonical competition history for events listed above;
- next-module unlock state.

Structured Pokémon/team/player state remains owned by the engine.

---

# 7. CALLBACK MATRIX

Required callback classes:

| Source | M9 behavior | Future behavior |
|---|---|---|
| prior conflict outcomes | alter context, reputation, access or information when relevant | remain persistent; never rewritten into a canonical choice |
| prior Friend Beats | influence relationship/schedule selection | rotation and callbacks continue |
| prior official results | appear in history/reputation where causal | never grant Rank by narration |
| ignored/failed quests | world may have resolved or worsened them | no frozen quest assumption |
| Anchor encounters | preserve relationship/result/schedule | eligible for later World/postgame callback |
| M9 Friend Beat | persist selected friend/type/result | later modules can reference it |

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

- `world_group_final_position registrata`;
- `world_group_advanced=true oppure world_eliminated=true`;
- `Top16 reale locked se avanzato`;
- `friend_beat_09_complete=true`;
- `m10_unlocked se avanzato`;
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

# P5E LIBROGAME — M06 PRODUCTION MAPPING

**Module:** M06 — Oltre i Confini  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M06_OLTRE_I_CONFINI_MODULE_DESIGN.md`  
**Purpose:** production map for converting M6 into validated offline story content  
**Locked authored budget:** **5,500 stitches / 3,400 player choices**

**Module implementation status:** **M6_00–M6_04 IMPLEMENTED / LIBRARY-V2 ALIGNED / STATIC-PASS — RUNTIME CI EVIDENCE PENDING**

E1–E7 are reusable infrastructure from M1. A block may extend generic data or content, but must not fork those engines into module-specific substitutes.

---

# 1. MACRO GRAPH

```text
M6_00_RANK_A_HANDOFF
   ↓
M6_01_ROUTE_SELECTION
   ↓
M6_02_INTERREGIONAL_TRAVEL
   ↓
M6_03_RED_ENTERS
   ↓
M6_04_MASTERS_CIRCUIT
   ↓
M6_05_HIDDEN_TRAJECTORIES
   ↓
M6_06_FRIEND_BEAT_06
   ↓
M6_07_CONTINENTAL_ENTRY
   ↓
M6_08_CONTINENTAL_CUP
   ↓
M6_09_ANCIENT_LAYER_TWO
   ↓
M6_10_FIRST_LIGHTHOUSE_RETURN
   ↓
M6_11_TRIAL_REGISTRATION
   ↓
M6_12_PROMOTION_TRIAL_A_S
   ↓
M6_13_WORLD_CUTOFF
   ↓
M6_14_MODULE_OUTCOME
```

This is a production ordering spine, not a forced linear playthrough. Free exploration, world progression, optional content and legal postponement can reconnect between blocks.

---

# 2. BUDGET MAP

| Block | Function | Stitches | Choices | Current state |
|---|---|---:|---:|---|
| M6_00_RANK_A_HANDOFF | ereditare Masters entry e licenza interregionale | 281 | 174 | IMPLEMENTED |
| M6_01_ROUTE_SELECTION | scelta reale tra tratte disponibili senza obbligo di visitarle tutte | 331 | 204 | IMPLEMENTED |
| M6_02_INTERREGIONAL_TRAVEL | Solaria/Luminara o altra tratta legale con tempi reali | 330 | 204 | IMPLEMENTED |
| M6_03_RED_ENTERS | introduzione di Red come competitor osservatore | 330 | 204 | IMPLEMENTED |
| M6_04_MASTERS_CIRCUIT | eventi Masters e ranking senza geographic bypass | 330 | 204 | IMPLEMENTED |
| M6_05_HIDDEN_TRAJECTORIES | A6_HIDDEN_TRAJECTORIES e payoff visibile di un amico | 330 | 204 | PLANNED |
| M6_06_FRIEND_BEAT_06 | evoluzione/cambio carriera/incontro reale di uno dei Four | 479 | 296 | PLANNED |
| M6_07_CONTINENTAL_ENTRY | eligibility e preparazione alla Continental Cup | 281 | 174 | PLANNED |
| M6_08_CONTINENTAL_CUP | A6_CONTINENTAL con bracket reale | 479 | 296 | PLANNED |
| M6_09_ANCIENT_LAYER_TWO | secondo strato del mistero, ancora non una ricompensa leggendaria gratuita | 330 | 204 | PLANNED |
| M6_10_FIRST_LIGHTHOUSE_RETURN | ritorno alle Rovine del Primo Faro e gate context | 330 | 204 | PLANNED |
| M6_11_TRIAL_REGISTRATION | eligibility A→S separata dai punti Masters | 430 | 266 | PLANNED |
| M6_12_PROMOTION_TRIAL_A_S | checkpoint RANK_A_TO_S, roster ufficiale 6 | 479 | 296 | PLANNED |
| M6_13_WORLD_CUTOFF | A6_CUTOFF: deadline e freeze eligibility/ranking | 479 | 296 | PLANNED |
| M6_14_MODULE_OUTCOME | Rank S e handoff verso Meridiana | 281 | 174 | PLANNED |
| **TOTAL** |  | **5,500** | **3,400** | |

Budgets are authored surface capacity. One run sees only the paths made legal by its state.

## 2A. RUNTIME LOGICAL PRODUCTION TRACKING

The authored-surface budget above remains locked at **5,500 stitches / 3,400 choices**. Runtime production follows the canonical M6 target of approximately **220 logical nodes / 484 meaningful choices**.

The first production cycle is allocated proportionally from the fixed M6 budget:

| Block | Logical nodes | Meaningful choices | Status |
|---|---:|---:|---|
| M6_00_RANK_A_HANDOFF | 11 | 25 | COMPLETE |
| M6_01_ROUTE_SELECTION | 13 | 29 | COMPLETE |
| M6_02_INTERREGIONAL_TRAVEL | 13 | 29 | COMPLETE |
| M6_03_RED_ENTERS | 13 | 29 | COMPLETE |
| M6_04_MASTERS_CIRCUIT | 14 | 29 | COMPLETE |
| **Cycle M6_00–M6_04** | **64** | **141** | **IMPLEMENTED / STATIC PASS** |
| **Remaining M6 target** | **156** | **343** | PLANNED |

This is the proportional share implied by the locked authored budget. No node is added merely to hit a number.

## 2B. LIBRARY V2 ROUTING FOR CYCLE 1

- **M6_00:** R21 module handoff + R33 cross-module callback + R16 eligibility information + R32 wait/time.
- **M6_01:** R34 access boundary + R01 location/return + R32 wait/time + R33 callbacks.
- **M6_02:** R01 location entry/return + R22 temporal variation + R32 waiting + R33 continuity; travel time remains E2-owned.
- **M6_03:** R24 persistent first meeting + R25 multi-context Anchor intro + R23 schedule causality + R33 callbacks; Red's adaptive silence is the unique layer.
- **M6_04:** R15 official match lifecycle + R06 combat handoff + R16 eligibility + R33 continuity; ranking consequences remain E5-owned.

**No R39 candidate is required.** Library V2 R01→R38 is sufficient for the complete first M6 cycle.

### Cycle 1 validation status

- authored files: present;
- exact logical budget: **64 nodes / 141 choices**;
- static schema/condition/effect/target audit: **PASS**;
- authored-node reachability: **PASS, 0 unreachable nodes**;
- dedicated budget/runtime/save tests: authored in `m06-cycle-budget.test.mjs` and `m06-cycle1.test.mjs`;
- GitHub Actions runtime evidence: **PENDING** because no workflow/check was emitted for the current PR head during this production pass.

Per the production rule, final **COMPLETE** status is reserved for runtime evidence.

---

# 3. CANONICAL EVENT BINDINGS

- `A6_HIDDEN_TRAJECTORIES`
- `A6_CONTINENTAL`
- `A6_RANK_TRIAL_A_S`
- `A6_CUTOFF`

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

## M6_00_RANK_A_HANDOFF

**Purpose:** ereditare Masters entry e licenza interregionale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Reuse class:** REUSE

**Source archetypes:**
- R21_MODULE_HANDOFF
- R33_CROSS_MODULE_CALLBACK
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO
- R32_WAIT_LET_TIME_PASS

**Unique layer:** Rank A continuity into the international phase without granting Red, Masters results, World cutoff or A→S progress.

**Implementation lock (cycle 1):** Scene `m06-handoff` contains **11 nodes / 25 meaningful choices**. It activates only M6, preserves all M5 state, distinguishes interregional license from route choice, and never changes Rank A or later M6 outcomes.

---

## M6_01_ROUTE_SELECTION

**Purpose:** scelta reale tra tratte disponibili senza obbligo di visitarle tutte.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Reuse class:** ADAPT

**Source archetypes:**
- R34_ACCESS_BOUNDARY_RECONNAISSANCE_GATE
- R01_LOCATION_ENTRY_RETURN
- R32_WAIT_LET_TIME_PASS
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** real route choice between interregional destinations without checklist travel or geographic bypass.

**Implementation lock (cycle 1):** Scene `m06-route-selection` contains **13 nodes / 29 meaningful choices**. Solaria and Luminara are alternative first routes; waiting advances E2; route selection persists before departure; neither destination is auto-visited.

---

## M6_02_INTERREGIONAL_TRAVEL

**Purpose:** Solaria/Luminara o altra tratta legale con tempi reali.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Reuse class:** ADAPT

**Source archetypes:**
- R01_LOCATION_ENTRY_RETURN
- R22_TIME_OF_DAY_VARIANT
- R32_WAIT_LET_TIME_PASS
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** interregional transit with persistent travel time, delay and destination-specific arrival.

**Implementation lock (cycle 1):** Scene `m06-interregional-travel` contains **13 nodes / 29 meaningful choices**. Solaria consumes 240 minutes, Luminara 300 minutes, delays consume additional real time, and arrival writes geography without changing Rank or fabricating competitive results.

---

## M6_03_RED_ENTERS

**Purpose:** introduzione di Red come competitor osservatore.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Reuse class:** ADAPT

**Source archetypes:**
- R24_PERSISTENT_NPC_FIRST_MEETING
- R25_MULTI_CONTEXT_ANCHOR_INTRO
- R23_NPC_PRESENCE_SCHEDULE_GATE
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** Red's sparse, observational style and adaptation philosophy inside an international career context.

**Implementation lock (cycle 1):** Scene `m06-red-enters` contains **13 nodes / 29 meaningful choices**. First meeting is persistent/idempotent, observation may defer contact, relationship changes carry no hidden bonus, and Charmander→Charmeleon→Charizard remains career history rather than scene-granted state.

---

## M6_04_MASTERS_CIRCUIT

**Purpose:** eventi Masters e ranking senza geographic bypass.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Reuse class:** ADAPT

**Source archetypes:**
- R15_FIRST_OFFICIAL_MATCH_LIFECYCLE
- R06_COMBAT_HANDOFF
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** first M6 Masters window as an international Rank A performance test whose result feeds later ranking/cutoff without becoming the A→S gate.

**Implementation lock (cycle 1):** Scene `m06-masters-circuit` contains **14 nodes / 29 meaningful choices**. Registration is separate from result; Official Five eligibility is enforced; the battle uses the Pokémon 5e/E5 combat handoff; win/loss are both persistent legal outcomes; Rank A is never changed by this block.

---

## M6_05_HIDDEN_TRAJECTORIES

**Purpose:** A6_HIDDEN_TRAJECTORIES e payoff visibile di un amico.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M6_06_FRIEND_BEAT_06

**Purpose:** evoluzione/cambio carriera/incontro reale di uno dei Four.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M6_07_CONTINENTAL_ENTRY

**Purpose:** eligibility e preparazione alla Continental Cup.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M6_08_CONTINENTAL_CUP

**Purpose:** A6_CONTINENTAL con bracket reale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M6_09_ANCIENT_LAYER_TWO

**Purpose:** secondo strato del mistero, ancora non una ricompensa leggendaria gratuita.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M6_10_FIRST_LIGHTHOUSE_RETURN

**Purpose:** ritorno alle Rovine del Primo Faro e gate context.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M6_11_TRIAL_REGISTRATION

**Purpose:** eligibility A→S separata dai punti Masters.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M6_12_PROMOTION_TRIAL_A_S

**Purpose:** checkpoint RANK_A_TO_S, roster ufficiale 6.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M6_13_WORLD_CUTOFF

**Purpose:** A6_CUTOFF: deadline e freeze eligibility/ranking.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M6_14_MODULE_OUTCOME

**Purpose:** Rank S e handoff verso Meridiana.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


# 6. STATE OWNERSHIP

Primary state families:

- `m6_complete`;
- Anchor state for Red;
- `friend_beat_06_*`;
- module-specific conflict/outcome state;
- canonical competition history for events listed above;
- next-module unlock state.

Structured Pokémon/team/player state remains owned by the engine.

---

# 7. CALLBACK MATRIX

Required callback classes:

| Source | M6 behavior | Future behavior |
|---|---|---|
| prior conflict outcomes | alter context, reputation, access or information when relevant | remain persistent; never rewritten into a canonical choice |
| prior Friend Beats | influence relationship/schedule selection | rotation and callbacks continue |
| prior official results | appear in history/reputation where causal | never grant Rank by narration |
| ignored/failed quests | world may have resolved or worsened them | no frozen quest assumption |
| Anchor encounters | preserve relationship/result/schedule | eligible for later World/postgame callback |
| M6 Friend Beat | persist selected friend/type/result | later modules can reference it |

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

- `current_rank=S`;
- `red_met=true`;
- `friend_beat_06_complete=true`;
- `world_cutoff_state persistente`;
- `ancient_mystery_layer_2 persistente`;
- `m07_unlocked=true`;

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

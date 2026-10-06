# P5E LIBROGAME — M07 PRODUCTION MAPPING

**Module:** M07 — Sotto i Riflettori  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M07_SOTTO_I_RIFLETTORI_MODULE_DESIGN.md`  
**Purpose:** production map for converting M7 into validated offline story content  
**Locked authored budget:** **5,200 stitches / 3,200 player choices**

**Module implementation status:** **M7_00–M7_04 IMPLEMENTED / LIBRARY-V2 ALIGNED / STATIC-PASS — RUNTIME CI EVIDENCE PENDING**

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

## 2A. RUNTIME LOGICAL PRODUCTION TRACKING

The authored-surface budget above remains locked at **5,200 stitches / 3,200 choices**. Runtime production follows the canonical M7 target of **210 logical nodes / 462 meaningful choices**.

| Block | Logical nodes | Meaningful choices | Status |
|---|---:|---:|---|
| M7_00_RANK_S_HANDOFF | 12 | 26 | IMPLEMENTED |
| M7_01_MERIDIANA_ARRIVAL | 14 | 31 | IMPLEMENTED |
| M7_02_CYNTHIA_ENTERS | 14 | 31 | IMPLEMENTED |
| M7_03_MEDIA_SPONSOR | 14 | 31 | IMPLEMENTED |
| M7_04_PRO_PREPARATION | 12 | 26 | IMPLEMENTED |
| **Cycle M7_00–M7_04** | **66** | **145** | **IMPLEMENTED / STATIC PASS** |
| M7_05_FRIEND_BEAT_07 | 20 | 44 | PLANNED |
| M7_06_QUALIFIER_REGISTRATION | 18 | 40 | PLANNED |
| M7_07_WORLD_QUALIFIER | 20 | 44 | PLANNED |
| M7_08_QUALIFIER_RESULT | 18 | 40 | PLANNED |
| M7_09_LAST_CHANCE_GATE | 14 | 31 | PLANNED |
| M7_10_LAST_CHANCE | 14 | 31 | PLANNED |
| M7_11_BEFORE_THE_LIGHTS | 14 | 31 | PLANNED |
| M7_12_WORLDS_MISSED | 14 | 30 | PLANNED |
| M7_13_MODULE_OUTCOME | 12 | 26 | PLANNED |
| **M7 TOTAL** | **210** | **462** | |

The first cycle therefore leaves exactly **144 nodes / 317 meaningful choices** for M7_05–M7_13. No node is added merely to hit the number.

## 2B. LIBRARY V2 ROUTING FOR CYCLE 1

- **M7_00:** R21 module handoff + R33 cross-module callback + R16 eligibility information + R32 wait/time.
- **M7_01:** R01 location entry/return + R02 hub navigation + R13 medical/service shell + R32 wait/time.
- **M7_02:** R24 persistent first meeting + R25 multi-context Anchor intro + R23 schedule causality + R33 callbacks.
- **M7_03:** R11 persistent lifecycle/commitment state + R23 availability/context + R32 time cost + R33 callbacks. Sponsor/media state never grants a combat/stat bonus.
- **M7_04:** R16 roster preparation/eligibility info + R13 medical-service shell + R32 time allocation + R33 continuity. Training/scouting choices schedule or record intent; they do not fork Pokémon 5e systems.

**No R39 candidate is required.** Library V2 R01→R38 is sufficient for the complete first M7 cycle.

### Cycle 1 validation status

- authored files: present;
- exact logical budget: **66 nodes / 145 meaningful choices**;
- authored-surface manifest: **5,200 stitches / 3,200 choices**;
- static condition/effect/target design audit: **PASS**;
- authored-node reachability: locked by `m07-cycle-budget.test.mjs`;
- Rank S / World qualification separation: explicit in M7_00 and dedicated tests;
- Cynthia first meeting: persistent/idempotent and non-boss;
- media/sponsor: no hidden combat/stat bonus;
- pro preparation: reads actual roster size and does not register the Qualifier;
- runtime regression authored in `m07-cycle1.test.mjs`;
- GitHub Actions runtime evidence: **PENDING**.

Final **COMPLETE** remains reserved for executable runtime evidence.

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



**Reuse class:** REUSE

**Source archetypes:**
- R21_MODULE_HANDOFF
- R33_CROSS_MODULE_CALLBACK
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO
- R32_WAIT_LET_TIME_PASS

**Unique layer:** Rank S is inherited as access to the World-candidate phase while `world_qualified` remains untouched.

**Implementation lock (cycle 1):** Scene `m07-handoff` contains **12 nodes / 26 meaningful choices**. It preserves M6 state, makes the Rank S / qualification distinction explicit, allows legal deferral and hands off to Meridiana without fabricating World entry.

---

## M7_01_MERIDIANA_ARRIVAL

**Purpose:** Grand Hall, servizi pro, medicina e stazione internazionale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.



**Reuse class:** ADAPT

**Source archetypes:**
- R01_LOCATION_ENTRY_RETURN
- R02_HUB_NAVIGATION
- R13_MEDICAL_POKEMON_CENTER_SERVICE
- R32_WAIT_LET_TIME_PASS

**Unique layer:** Meridiana is a dense Rank S professional hub where services compete for time but none bypasses medical, roster, travel or competition systems.

**Implementation lock (cycle 1):** Scene `m07-meridiana-arrival` contains **14 nodes / 31 meaningful choices**. Arrival writes real geography, exposes Grand Hall/arena/medicine/university/station/media services and never changes Rank or World qualification.

---

## M7_02_CYNTHIA_ENTERS

**Purpose:** introduzione di Cynthia come peer/benchmark, non boss.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.



**Reuse class:** ADAPT

**Source archetypes:**
- R24_PERSISTENT_NPC_FIRST_MEETING
- R25_MULTI_CONTEXT_ANCHOR_INTRO
- R23_NPC_PRESENCE_SCHEDULE_GATE
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** Cynthia's identity is long-horizon resource protection and planning; she is a peer/benchmark rather than a forced boss.

**Implementation lock (cycle 1):** Scene `m07-cynthia-enters` contains **14 nodes / 31 meaningful choices**. First meeting is persistent/idempotent, observation can defer contact, relationship state is durable, and Gible→Gabite→Garchomp remains career history rather than scene-granted power.

---

## M7_03_MEDIA_SPONSOR

**Purpose:** pressione pubblica e contratti senza bonus meccanici illegali.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.



**Reuse class:** ADAPT

**Source archetypes:**
- R11_QUEST_LIFECYCLE
- R23_NPC_PRESENCE_SCHEDULE_GATE
- R32_WAIT_LET_TIME_PASS
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** public exposure and sponsor posture create durable agenda/reputation pressure without hidden stat, dice or combat bonuses.

**Implementation lock (cycle 1):** Scene `m07-media-sponsor` contains **14 nodes / 31 meaningful choices**. Independent/local/major sponsor posture and media style persist; time costs are real; no World qualification, Rank change or mechanical buff is granted.

---

## M7_04_PRO_PREPARATION

**Purpose:** training, scouting e gestione squadra con regole reali.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.



**Reuse class:** ADAPT

**Source archetypes:**
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO
- R13_MEDICAL_POKEMON_CENTER_SERVICE
- R32_WAIT_LET_TIME_PASS
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** Rank S preparation is an agenda problem across roster, training, scouting, recovery and public obligations while Pokémon/team state remains engine-owned.

**Implementation lock (cycle 1):** Scene `m07-pro-preparation` contains **12 nodes / 26 meaningful choices**. Readiness checks the actual roster, training/scouting record priorities without directly changing Pokémon stats, medicine never auto-heals, and completion does not register or resolve the World Qualifier.

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

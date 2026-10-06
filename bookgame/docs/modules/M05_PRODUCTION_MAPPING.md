# P5E LIBROGAME — M05 PRODUCTION MAPPING

**Module:** M05 — Sopra le Nuvole  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M05_SOPRA_LE_NUVOLE_MODULE_DESIGN.md`  
**Purpose:** production map for converting M5 into validated offline story content  
**Locked authored budget:** **5,700 stitches / 3,600 player choices**

**Module implementation status:** **M5_00–M5_04 COMPLETE / LIBRARY-V2 ALIGNED; M5_05–M5_14 PLANNED**

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
| M5_00_RANK_B_HANDOFF | ereditare costa, circuiti e roster maturato | 308 | 194 | COMPLETE |
| M5_01_MOUNTAIN_APPROACH | aprire Monti Ferrox con viaggio e rischio meteo | 362 | 229 | COMPLETE |
| M5_02_ALTACIMA | hub di quota, medicina, logistica e Sala della Cresta | 362 | 229 | COMPLETE |
| M5_03_LANCE_ENTERS | introduzione di Lance tramite carriera reale | 362 | 229 | COMPLETE |
| M5_04_WEATHER_DECISIONS | finestre meteo, rinvio, deviazione e rischio | 362 | 229 | COMPLETE |
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

## 2A. RUNTIME LOGICAL PRODUCTION TRACKING

The authored-surface budget above remains locked at **5,700 stitches / 3,600 choices**. Runtime production follows the canonical logical target for M5 of approximately **240 logical nodes / 528 meaningful choices**.

The first production cycle is allocated proportionally from the fixed M5 budget and implemented exactly as follows:

| Block | Logical nodes | Meaningful choices | Status |
|---|---:|---:|---|
| M5_00_RANK_B_HANDOFF | 13 | 28 | COMPLETE |
| M5_01_MOUNTAIN_APPROACH | 16 | 34 | COMPLETE |
| M5_02_ALTACIMA | 16 | 34 | COMPLETE |
| M5_03_LANCE_ENTERS | 15 | 34 | COMPLETE |
| M5_04_WEATHER_DECISIONS | 15 | 34 | COMPLETE |
| **Cycle M5_00–M5_04** | **75** | **164** | **COMPLETE** |
| **Remaining M5_05–M5_14 capacity** | **~165** | **~364** | PLANNED |

No nodes were added merely to hit a number. The 75/164 cycle preserves the full branch density required by the five engine jobs while leaving the remaining capacity for Fulgore, Ancient Trace, interregional licensing, Five reunion, Friend Beat, high-altitude event, B→A Trial, Masters entry and exit synthesis.

## 2B. LIBRARY V2 ROUTING FOR CYCLE 1

- **M5_00:** R21 module handoff + R33 cross-module callback + R32 wait/time; no new topology.
- **M5_01:** R01 location entry, R03 checks, R22 time variant, R32 waiting, R33 callbacks and R34 access boundary; mountain-specific risk is local content.
- **M5_02:** R02 hub navigation, R12 shop, R13 medical service shell, R14 arena reception, R16 eligibility information and R32 waiting.
- **M5_03:** R24 persistent first meeting + R25 multi-context Anchor intro + R23 schedule causality + R33 callbacks; Lance's risk philosophy is the unique layer.
- **M5_04:** R22 time-of-day windows + R32 waiting + R03 checks + R04 information flags; weather decisions are an adaptation, not a new engine.

**No R39 candidate is required.** R01→R38 remain structurally sufficient for this cycle.

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

**Reuse class:** REUSE

**Source archetypes:**
- R21_MODULE_HANDOFF
- R33_CROSS_MODULE_CALLBACK
- R32_WAIT_LET_TIME_PASS

**Unique layer:** Rank B continuity from the completed coastal arc into the high-altitude phase without granting any later M5 outcome.

**Implementation lock (verified in cycle authoring):** Scene `m05-handoff` contains **13 nodes / 28 meaningful choices**. It requires real `m4_complete`, `m05_unlocked` and structured Rank B; activates only `m5_active`; preserves prior roster/resources/history; and can depart toward Monti Ferrox without granting Lance, interregional license, B→A Trial state or Fulgore completion.

---

## M5_01_MOUNTAIN_APPROACH

**Purpose:** aprire Monti Ferrox con viaggio e rischio meteo.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Reuse class:** ADAPT

**Source archetypes:**
- R01_LOCATION_ENTRY_RETURN
- R03_SIMPLE_SKILL_CHECK
- R22_TIME_OF_DAY_VARIANT
- R32_WAIT_LET_TIME_PASS
- R33_CROSS_MODULE_CALLBACK
- R34_ACCESS_BOUNDARY_RECONNAISSANCE_GATE

**Unique layer:** Monti Ferrox route choice, exposure, shelter and risk-margin fiction.

**Implementation lock (verified in cycle authoring):** Scene `m05-mountain-approach` contains **16 nodes / 34 meaningful choices**. Service-road and high-trail routes consume real E2 time; checks preserve legitimate failure; shelter/wait advances the same clock; prior Ferrox history is read only when it exists; and Altacima access confirms Rank B geography without changing Rank or fabricating injury state.

---

## M5_02_ALTACIMA

**Purpose:** hub di quota, medicina, logistica e Sala della Cresta.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Reuse class:** ADAPT

**Source archetypes:**
- R02_HUB_NAVIGATION
- R12_SHOP_MARKET
- R13_MEDICAL_POKEMON_CENTER_SERVICE
- R14_ARENA_RECEPTION
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO
- R32_WAIT_LET_TIME_PASS

**Unique layer:** Altacima's high-altitude logistics, Sala della Cresta and Fulgore-facing service identity.

**Implementation lock (verified in cycle authoring):** Scene `m05-altacima` contains **16 nodes / 34 meaningful choices**. The hub exposes clinic, logistics, Crest Hall, market, rest and weather as separate real services; purchases use persistent money/stock; clinic information never heals by narration; Trial information never registers `RANK_B_TO_A`; and Lance becomes contactable only after causal local context.

---

## M5_03_LANCE_ENTERS

**Purpose:** introduzione di Lance tramite carriera reale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Reuse class:** ADAPT

**Source archetypes:**
- R24_PERSISTENT_NPC_FIRST_MEETING
- R25_MULTI_CONTEXT_ANCHOR_INTRO
- R23_NPC_PRESENCE_SCHEDULE_GATE
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** Lance's stage-aware dragon career and risk-margin philosophy in high-altitude competition.

**Implementation lock (verified in cycle authoring):** Scene `m05-lance-enters` contains **15 nodes / 34 meaningful choices**. Lance can be met from Crest Hall, weather context or a deferred recovery path; first-meeting registration is persistent/idempotent; relationship choices persist; Dratini→Dragonair→Dragonite is discussed as earned career progression rather than assigned form; and meeting Lance cannot alter Rank, license, roster or money.

---

## M5_04_WEATHER_DECISIONS

**Purpose:** finestre meteo, rinvio, deviazione e rischio.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Reuse class:** ADAPT

**Source archetypes:**
- R22_TIME_OF_DAY_VARIANT
- R32_WAIT_LET_TIME_PASS
- R03_SIMPLE_SKILL_CHECK
- R04_CHECK_INFORMATION_FLAG

**Unique layer:** dynamic high-altitude decision matrix across departure, postponement, deviation and accepted uncertainty.

**Implementation lock (verified in cycle authoring):** Scene `m05-weather-decisions` contains **15 nodes / 34 meaningful choices**. Morning/afternoon/evening/night expose distinct windows; waiting advances E2; checks can fail into real uncertainty; Lance context changes interpretation only, not mechanics; and the block may set `m5_fulgore_departure_ready` but deliberately never marks Fulgore visited, grants a permanent weather permit, changes Rank or awards interregional licensing.

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

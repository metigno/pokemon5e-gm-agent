# P5E LIBROGAME — M08 PRODUCTION MAPPING

**Module:** M08 — Il Mondo nello Stesso Posto  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M08_IL_MONDO_NELLO_STESSO_POSTO_MODULE_DESIGN.md`  
**Purpose:** production map for converting M8 into validated offline story content  
**Locked authored budget:** **4,400 stitches / 2,500 player choices**

**Module implementation status:** **M8_00–M8_09 IMPLEMENTED / LIBRARY-V2 ALIGNED / RUNTIME VALIDATION PENDING**

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

# 2A. RUNTIME LOGICAL PRODUCTION TRACKING

The authored-surface budget above remains locked at **4,400 stitches / 2,500 choices**. Runtime production follows the agreed M8 target of **190 logical nodes / 418 meaningful choices**.

| Block | Logical nodes | Meaningful choices | Status |
|---|---:|---:|---|
| M8_00_WORLD_ARRIVAL | 21 | 46 | IMPLEMENTED |
| M8_01_ACCREDITATION | 14 | 31 | IMPLEMENTED |
| M8_02_MEDICAL_CONTROL | 14 | 31 | IMPLEMENTED |
| M8_03_REGISTRATION | 12 | 27 | IMPLEMENTED |
| M8_04_WORLD_VILLAGE | 21 | 46 | IMPLEMENTED |
| **Cycle M8_00–M8_04** | **82** | **181** | **COMPLETE / RUNTIME PASS** |
| M8_05_ASTRID_ENTERS | 14 | 31 | IMPLEMENTED |
| M8_06_FRIEND_BEAT_08 | 20 | 44 | IMPLEMENTED |
| M8_07_TRAINING_HALL | 15 | 33 | IMPLEMENTED |
| M8_08_MEDIA_DAY | 15 | 32 | IMPLEMENTED |
| M8_09_OPENING_CEREMONY | 12 | 26 | IMPLEMENTED |
| **Cycle M8_05–M8_09** | **76** | **166** | **IMPLEMENTED / STATIC PASS** |
| M8_10_WORLD_DRAW | TBD | TBD | PLANNED |
| M8_11_GROUP_REVEAL | TBD | TBD | PLANNED |
| **M8 TOTAL TARGET** | **190** | **418** | |

The first cycle used **82 / 181**. Cycle 2 adds **76 / 166**, bringing M8_00–M8_09 to **158 nodes / 347 meaningful choices**. Exactly **32 nodes / 71 choices** remain for M8_10–M8_11. No node is added merely to hit the target.

# 2B. LIBRARY V2 ROUTING FOR CYCLE 1

- **M8_00:** R21 module handoff + R01 location entry/return + R33 cross-module callbacks + R32 wait/time. The World-qualified result is read from M7 and never rewritten.
- **M8_01:** R16 eligibility/information + R34 access boundary + R02 hub/navigation + R32 wait/time. Accreditation controls access and timeline only.
- **M8_02:** R13 medical/service shell + R16 eligibility information + R32 time cost + R33 continuity. The scene never heals or rewrites structured Pokémon state.
- **M8_03:** R17 registration shell adapted to World participation + R16 roster/eligibility info + R34 gate boundary + R33 continuity. Registration never performs WORLD_DRAW or fabricates a group.
- **M8_04:** R02 hub/navigation + R23 NPC presence/schedule causality + R32 wait/time + R33 callbacks. Friend/Anchor meetings remain causal; no NPC teleport is introduced.

**No R39 candidate is required.** Library V2 R01→R38 is sufficient for the complete first M8 cycle.

### Cycle 1 validation status

- authored files: present;
- exact logical budget: **82 nodes / 181 meaningful choices**;
- authored-surface manifest: **4,400 stitches / 2,500 choices**;
- all 82 authored nodes have an incoming route and are reachable from their scene entries;
- World entry requires the real M7 qualified route;
- accreditation does not alter Rank, roster or draw;
- medical control never heals or rewrites Pokémon state;
- registration reads the actual roster and never sets World field/group/draw state;
- World Village preserves schedule-causal NPC encounters;
- dedicated regressions: `m08-cycle1.test.mjs` and `m08-cycle-budget.test.mjs`;
- GitHub Actions runtime evidence: **PASS** on content commit `2541e060424e5d2cc4a48451c3344dcf839d846b`, Bookgame Tests run `37454771937` (#336) — **1,174 passed / 0 failed**.


# 2C. LIBRARY V2 ROUTING FOR CYCLE 2

- **M8_05:** R24 persistent NPC first meeting + R25 multi-context Anchor intro + R23 schedule causality + R33 callbacks. Astrid Vahl is registered by a living-world event with a real World Village schedule before the scene becomes available.
- **M8_06:** R26 Friend Beat selector + R27 Friend Beat content + R23 schedule/location causality + R33 continuity. Physical contact is selected only for a real World Village overlap; otherwise the contact is remote and no qualification is invented.
- **M8_07:** R05 optional sparring + R06 Pokémon 5e combat handoff + R13 medical/readiness shell + R32 time allocation. The declared Lucario Lv18 staff spar is non-official and never enters World competition history.
- **M8_08:** R11 persistent posture/commitment state + R32 time cost + R33 callbacks. Media posture remains player-chosen and cannot modify Trainer/Pokémon statistics, seed or draw.
- **M8_09:** R23 real-presence continuity + R32 time + R33 callbacks + R34 boundary discipline. The opening ceremony presents the World stage but explicitly stops before WORLD_DRAW.

**No R39 candidate is required.** Library V2 R01→R38 remains sufficient through the complete pre-draw ceremony.

### Cycle 2 validation status

- authored files: present;
- exact cycle budget: **76 nodes / 166 meaningful choices**;
- cumulative M8 runtime surface: **158 nodes / 347 choices**;
- exact remaining M8 target: **32 nodes / 71 choices** for WORLD_DRAW + GROUP_REVEAL;
- Astrid exists as a persistent NPC with a real schedule and no final-boss protection;
- FRIEND_BEAT_08 uses physical overlap only when schedule/location make it causal, otherwise remote contact;
- Training Hall sparring uses Pokémon 5e combat handoff and is explicitly non-official;
- Media Day preserves player voice and never grants stat bonuses;
- Opening Ceremony never sets `world_draw_complete`, `world_field_32_locked` or `player_group`;
- dedicated regressions: `m08-cycle2.test.mjs` plus expanded `m08-cycle-budget.test.mjs`;
- runtime GitHub Actions evidence is required before marking this cycle COMPLETE.

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


**Reuse class:** REUSE

**Source archetypes:**
- R21_MODULE_HANDOFF
- R01_LOCATION_ENTRY_RETURN
- R33_CROSS_MODULE_CALLBACK
- R32_WAIT_LET_TIME_PASS

**Unique layer:** first physical arrival at the World Championship venue after a real M7 qualification, with no state reset and no premature draw.

**Implementation lock (cycle 1):** scene `m08-world-arrival` contains **21 nodes / 46 meaningful choices**. It requires the qualified M7 exit, keeps Rank/qualification intact, preserves roster/medical state and records only the physical arrival.

---

## M8_01_ACCREDITATION

**Purpose:** identità, accessi e timeline del torneo.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


**Reuse class:** ADAPT

**Source archetypes:**
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO
- R34_ACCESS_BOUNDARY
- R02_HUB_NAVIGATION
- R32_WAIT_LET_TIME_PASS

**Unique layer:** World participant credentials and venue access/timeline without treating accreditation as competitive progress.

**Implementation lock (cycle 1):** scene `m08-accreditation` contains **14 nodes / 31 meaningful choices**. Identity, access zones and timeline are persistent; no Rank, roster or WORLD_DRAW state is changed.

---

## M8_02_MEDICAL_CONTROL

**Purpose:** controllo medico che legge lo stato reale senza heal narrativo.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


**Reuse class:** REUSE

**Source archetypes:**
- R13_MEDICAL_POKEMON_CENTER_SERVICE
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO
- R32_WAIT_LET_TIME_PASS
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** mandatory World medical review that observes real persistent Pokémon state without healing by narration.

**Implementation lock (cycle 1):** scene `m08-medical-control` contains **14 nodes / 31 meaningful choices**. It may consume time and record completion, but never changes HP, PP, status, injury or roster contents.

---

## M8_03_REGISTRATION

**Purpose:** roster World ufficiale e lock secondo regole.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


**Reuse class:** ADAPT

**Source archetypes:**
- R17_QUALIFIER_REGISTRATION_SHELL
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO
- R34_ACCESS_BOUNDARY
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** World Championship participation registration after qualification, medical control and a real six-Pokémon roster, without generating field or group state.

**Implementation lock (cycle 1):** scene `m08-registration` contains **12 nodes / 27 meaningful choices**. The commit is guarded by `world_qualified`, medical completion and `player.roster.length >= 6`; WORLD_DRAW remains untouched.

---

## M8_04_WORLD_VILLAGE

**Purpose:** vita nel Village e incontri causali.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


**Reuse class:** ADAPT

**Source archetypes:**
- R02_HUB_NAVIGATION
- R23_NPC_PRESENCE_SCHEDULE_GATE
- R32_WAIT_LET_TIME_PASS
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** World Village as a persistent pre-tournament social hub where friend/Anchor encounters depend on real schedule and position.

**Implementation lock (cycle 1):** scene `m08-world-village` contains **21 nodes / 46 meaningful choices**. It establishes the Village and its services, allows time to pass, and explicitly avoids forcing Astrid or FRIEND_BEAT_08 into existence.

---

## M8_05_ASTRID_ENTERS

**Purpose:** campionessa in carica senza final-boss protection.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


**Reuse class:** ADAPT

**Source archetypes:**
- R24_PERSISTENT_NPC_FIRST_MEETING
- R25_MULTI_CONTEXT_ANCHOR_INTRO
- R23_NPC_PRESENCE_SCHEDULE_GATE
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** Astrid Vahl is the reigning champion but remains an ordinary competitive actor for future results; title prestige never becomes plot armor.

**Implementation lock (cycle 2):** scene `m08-astrid-enters` contains **14 nodes / 31 meaningful choices**. `M8_ASTRID_ARRIVAL` registers Astrid and her World Village schedule before contact; first meeting is persistent/idempotent and never assigns draw state.

---

## M8_06_FRIEND_BEAT_08

**Purpose:** scena personale con amico qualificato o contatto esterno.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


**Reuse class:** ADAPT

**Source archetypes:**
- R26_FRIEND_BEAT_SELECTOR
- R27_FRIEND_BEAT_CONTENT
- R23_NPC_PRESENCE_SCHEDULE_GATE
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** one of the Four intersects the World phase physically only if actually present in the Village; otherwise the beat is a remote contact that preserves uncertainty about the friend's competitive state.

**Implementation lock (cycle 2):** scene `m08-friend-beat-08` contains **20 nodes / 44 meaningful choices**. The selector avoids the protagonist and prior Friend Beat where possible, records friend/mode/type, and never creates qualification, seed or group state.

---

## M8_07_TRAINING_HALL

**Purpose:** preparazione e sparring opzionale con stato reale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


**Reuse class:** ADAPT

**Source archetypes:**
- R05_OPTIONAL_SPARRING
- R06_COMBAT_HANDOFF
- R13_MEDICAL_POKEMON_CENTER_SERVICE
- R32_WAIT_LET_TIME_PASS

**Unique layer:** pre-draw World preparation with an optional declared 1v1 staff spar against Lucario Lv18; real battle state persists but the spar is not an official World match.

**Implementation lock (cycle 2):** scene `m08-training-hall` contains **15 nodes / 33 meaningful choices**. Technical preparation consumes real time without free stat gains, while optional sparring hands authority to Pokémon 5e and never touches E5 World history.

---

## M8_08_MEDIA_DAY

**Purpose:** interviste e reputazione senza imporre voce al player.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


**Reuse class:** ADAPT

**Source archetypes:**
- R11_QUEST_LIFECYCLE
- R32_WAIT_LET_TIME_PASS
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** player-selected public posture at the World venue, including Astrid/Four/sponsor callbacks, without assigning a mandatory personality or mechanical buff.

**Implementation lock (cycle 2):** scene `m08-media-day` contains **15 nodes / 32 meaningful choices**. Open, guarded and competitive postures are persistent narrative state only; Trainer/Pokémon stats and draw state remain untouched.

---

## M8_09_OPENING_CEREMONY

**Purpose:** cerimonia, field e atmosfera senza falsi risultati.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


**Reuse class:** ADAPT

**Source archetypes:**
- R23_NPC_PRESENCE_SCHEDULE_GATE
- R32_WAIT_LET_TIME_PASS
- R33_CROSS_MODULE_CALLBACK
- R34_ACCESS_BOUNDARY_RECONNAISSANCE_GATE

**Unique layer:** collective World opening that makes the field feel real while preserving a hard boundary before the canonical WORLD_DRAW.

**Implementation lock (cycle 2):** scene `m08-opening-ceremony` contains **12 nodes / 26 meaningful choices**. It records ceremony completion only and deliberately leaves field lock, player group and three opponents unresolved.

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

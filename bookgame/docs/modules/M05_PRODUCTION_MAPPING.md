# P5E LIBROGAME — M05 PRODUCTION MAPPING

**Module:** M05 — Sopra le Nuvole  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M05_SOPRA_LE_NUVOLE_MODULE_DESIGN.md`  
**Purpose:** production map for converting M5 into validated offline story content  
**Locked authored budget:** **5,700 stitches / 3,600 player choices**

**Module implementation status:** **M5_00–M5_14 COMPLETE / LIBRARY-V2 ALIGNED**

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
| M5_05_FULGORE_ASCENT | accesso all'Altopiano Fulgore e pressione ambientale | 362 | 229 | COMPLETE |
| M5_06_ANCIENT_TRACE | A5_TRACE: anomalia antica/meteorologica senza soluzione prematura | 362 | 229 | COMPLETE |
| M5_07_INTERREGIONAL_LICENSE | A5_INTERREGIONAL e apertura di tratte più ampie | 362 | 229 | COMPLETE |
| M5_08_FIVE_CROSS_AGAIN | A5_FIVE_CROSS: reunion causale dei Five | 362 | 228 | COMPLETE |
| M5_09_FRIEND_BEAT_05 | beat personale obbligatorio dentro la reunion | 525 | 331 | COMPLETE |
| M5_10_HIGH_ALTITUDE_EVENT | soccorso/competizione/lavoro ad alta quota con stato reale | 362 | 228 | COMPLETE |
| M5_11_TRIAL_REGISTRATION | eligibility B→A ad Altacima | 470 | 297 | COMPLETE |
| M5_12_PROMOTION_TRIAL_B_A | checkpoint RANK_B_TO_A, roster ufficiale 5 | 525 | 331 | COMPLETE |
| M5_13_MASTERS_ENTRY | A5_MASTERS_ENTRY dopo Rank A, senza sostituire il gate | 307 | 194 | COMPLETE |
| M5_14_MODULE_OUTCOME | Rank A, licenza interregionale e handoff M6 | 307 | 194 | COMPLETE |
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
| M5_05_FULGORE_ASCENT | 15 | 34 | COMPLETE |
| M5_06_ANCIENT_TRACE | 15 | 34 | COMPLETE |
| M5_07_INTERREGIONAL_LICENSE | 15 | 34 | COMPLETE |
| M5_08_FIVE_CROSS_AGAIN | 15 | 33 | COMPLETE |
| M5_09_FRIEND_BEAT_05 | 22 | 48 | COMPLETE |
| **Cycle M5_05–M5_09** | **82** | **183** | **COMPLETE** |
| **Cumulative M5_00–M5_09** | **157** | **347** | **COMPLETE** |
| M5_10_HIGH_ALTITUDE_EVENT | 15 | 32 | COMPLETE |
| M5_11_TRIAL_REGISTRATION | 14 | 31 | COMPLETE |
| M5_12_PROMOTION_TRIAL_B_A | 22 | 48 | COMPLETE |
| M5_13_MASTERS_ENTRY | 18 | 40 | COMPLETE |
| M5_14_MODULE_OUTCOME | 14 | 30 | COMPLETE |
| **Cycle M5_10–M5_14** | **83** | **181** | **COMPLETE** |
| **M5 TOTAL** | **240** | **528** | **COMPLETE** |

No nodes were added merely to hit a number. Cycle 2 consumes **82 nodes / 183 choices**, exactly the proportional share implied by the locked M5 budget: 15/34 for Fulgore, Trace and License; 15/33 for Five Cross; 22/48 for the deliberately broader FRIEND_BEAT_05. The final five blocks consume the remaining **83 nodes / 181 choices** exactly, bringing M5 to the locked logical target of **240 nodes / 528 meaningful choices** with no padding.

## 2B. LIBRARY V2 ROUTING FOR CYCLE 1

- **M5_00:** R21 module handoff + R33 cross-module callback + R32 wait/time; no new topology.
- **M5_01:** R01 location entry, R03 checks, R22 time variant, R32 waiting, R33 callbacks and R34 access boundary; mountain-specific risk is local content.
- **M5_02:** R02 hub navigation, R12 shop, R13 medical service shell, R14 arena reception, R16 eligibility information and R32 waiting.
- **M5_03:** R24 persistent first meeting + R25 multi-context Anchor intro + R23 schedule causality + R33 callbacks; Lance's risk philosophy is the unique layer.
- **M5_04:** R22 time-of-day windows + R32 waiting + R03 checks + R04 information flags; weather decisions are an adaptation, not a new engine.

**No R39 candidate is required.** R01→R38 remain structurally sufficient for this cycle.

## 2C. CYCLE M5_00–M5_04 VALIDATION EVIDENCE

Validation executed on GitHub Actions from branch `m5-00-04-work` after the five scenes, module manifest, regression tests and Library V2 declarations were present:

- syntax checks: **PASS**;
- `npm --prefix bookgame run validate:story`: **PASS**;
- compiled global graph: **61 scenes / 969 nodes / 1,323 stitches / 2,291 choices / 36 world events / 12 ecology zones / 416 ecology species**;
- compiled M05 authored surface currently present: **82 stitches / 164 choices** across the first five scenes;
- `npm --prefix bookgame test`: **1,028 pass / 0 fail / 0 skipped / 0 cancelled**;
- Node Library V2 policy tests: **PASS**, including the M05→M12 library-first declaration audit;
- workflow run: **#37432393064**;
- all M1–M4 regressions remain green.

The compiler still reports the pre-existing terminal/local-reachability warnings from older authored scene patterns; the M5 multi-context Lance entry also intentionally has alternate entry nodes that are reached cross-scene and therefore appear as local-reachability warnings, not validation errors.

## 2D. LIBRARY V2 ROUTING FOR CYCLE 2

- **M5_05:** R34 access boundary + R22/R32 time and waiting + R03 checks + R07 ordinary ecology observation; Fulgore exposure remains local content.
- **M5_06:** R30 evidence aggregation + R04 information flags + R38 composite interpretation discipline; the revelation stays intentionally incomplete.
- **M5_07:** R16 eligibility + R15 official match lifecycle + R06 combat handoff + R33 continuity; the assessment records a real win/loss without becoming a Rank checkpoint.
- **M5_08:** R23 schedule gate + R28 friend divergence/update + R33 callbacks; the reunion includes only causally available Five and keeps remote participants remote.
- **M5_09:** R26 friend selector + R27 Friend Beat content + R23 schedule causality + R33 callbacks; physical and remote paths remain distinct and persistent.

**No R39 candidate is required.** The second cycle is fully expressible with Library V2 R01→R38.

## 2E. CYCLE M5_05–M5_09 VALIDATION EVIDENCE

Validation executed on GitHub Actions from branch `m5-00-04-work` after the five cycle-two scenes, A5 event catalog, M5 ecology profile, budget locks and Library V2 declarations were present:

- syntax checks: **PASS**;
- `npm --prefix bookgame run validate:story`: **PASS**;
- compiled global graph: **66 scenes / 1,051 nodes / 1,405 stitches / 2,474 choices / 40 world events / 14 ecology zones / 479 ecology species**;
- compiled M05 authored surface currently present: **164 stitches / 347 choices** across M5_00–M5_09;
- logical M5 production surface: **157 nodes / 347 meaningful choices**, leaving **83 / 181** for M5_10–M5_14;
- `npm --prefix bookgame test`: **1,045 pass / 0 fail / 0 skipped / 0 cancelled**;
- first validation exposed exactly two strict-source issues: an invalid mixed E1 trigger shape and a Fulgore fauna candidate rejected by the compiled habitat filter; both were repaired at the source without broadening rules or weakening validation;
- final workflow run: **#37435071829**;
- M1–M4 and M5_00–M5_04 regressions remain green.

## 2F. LIBRARY V2 ROUTING FOR CYCLE 3

- **M5_10:** R31 local problem response + R36 multi-modal resolution + R35 conditional Lance co-action + R32 waiting + R03 checks. The high-altitude incident records direct rescue versus support without inventing injuries or credit.
- **M5_11:** R16 eligibility/roster information + R17 Promotion Trial registration. The scene writes only canonical E5 Trial availability/registration for `RANK_B_TO_A`.
- **M5_12:** R18 Promotion Trial gate + R06 combat handoff + R19 Rank result/retry. E5 alone changes Rank B→A on a real win; the fixed Official Five is never scaled to the player.
- **M5_13:** R16 eligibility information + R15 official match lifecycle + R06 combat handoff + R33 continuity. Masters Entry is seeding content, not a Rank checkpoint.
- **M5_14:** R38 composite outcome audit + R20 module exit contract + R21 module handoff + R33 callbacks. M6 unlock is written only after the full M5 exit contract is already true.

**No R39 candidate is required.** Library V2 R01→R38 remains sufficient for the complete M5 implementation.

## 2G. CYCLE M5_10–M5_14 / FULL M5 VALIDATION EVIDENCE

Final-cycle validation executed on GitHub Actions from branch `m5-00-04-work` after M5_10–M5_14 scenes, final A5 event bindings, runtime regressions, exact budget locks and Library V2 declarations were present:

- syntax checks: **PASS**;
- `npm --prefix bookgame run validate:story`: **PASS**;
- compiled global graph: **71 scenes / 1,134 nodes / 1,489 stitches / 2,655 choices / 44 world events / 14 ecology zones / 479 ecology species**;
- compiled M05 authored surface currently implemented: **248 stitches / 528 choices**;
- logical M05 production target: **240 logical nodes / 528 meaningful choices — EXACT**;
- `npm --prefix bookgame test`: **1,062 pass / 0 fail / 0 skipped / 0 cancelled**;
- final-cycle logical allocation: **83 nodes / 181 choices**;
- the first final-cycle test run exposed three obsolete assertions that treated canonical Trial availability as if it were Trial registration/progression; the tests were corrected to enforce the proper distinction `available=true`, `registered=false`, Rank B unchanged. No gameplay rule, event trigger or validator was weakened;
- final workflow run: **#37437324354**;
- M1–M4 plus all earlier M5 cycles remain green.

M5 is therefore complete at its locked logical runtime budget while retaining the separate authored-surface capacity budget of **5,700 stitches / 3,600 choices** for source planning/reporting purposes.

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

**Reuse class:** ADAPT

**Source archetypes:**
- R34_ACCESS_BOUNDARY_RECONNAISSANCE_GATE
- R22_TIME_OF_DAY_VARIANT
- R32_WAIT_LET_TIME_PASS
- R03_SIMPLE_SKILL_CHECK
- R07_WILD_OBSERVATION_REQUEST

**Unique layer:** exposed-ridge ascent, mid-course deviation, retreat logic and Fulgore ecology.

**Implementation lock:** Scene `m05-fulgore-ascent` contains **15 nodes / 34 meaningful choices**. It requires the real M5_04 departure plan, consumes E2 time, supports retreat/deviation, observes only canonical FUL-PLATEAU fauna, and writes `fulgore_visited` only after actual arrival.

---

## M5_06_ANCIENT_TRACE

**Purpose:** A5_TRACE: anomalia antica/meteorologica senza soluzione prematura.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Reuse class:** ADAPT

**Source archetypes:**
- R30_INVESTIGATION_EVIDENCE_AGGREGATION
- R04_CHECK_INFORMATION_FLAG
- R38_COMPOSITE_OUTCOME_CLASSIFIER
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** the first ancient/weather anomaly layer and its deliberate uncertainty.

**Implementation lock:** Scene `m05-ancient-trace` contains **15 nodes / 34 meaningful choices**. Multiple independent signals may converge, remain partial or be left largely uninvestigated. Every legal completion writes a persistent `ancient_mystery_layer_1` without identifying a legendary/mythical, granting a capture or fabricating evidence.

---

## M5_07_INTERREGIONAL_LICENSE

**Purpose:** A5_INTERREGIONAL e apertura di tratte più ampie.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Reuse class:** ADAPT

**Source archetypes:**
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO
- R15_FIRST_OFFICIAL_MATCH_LIFECYCLE
- R06_COMBAT_HANDOFF
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** a Rank-B interregional calibration assessment whose result informs the license but does not act as promotion.

**Implementation lock:** Scene `m05-interregional-license` contains **15 nodes / 34 meaningful choices**. The official assessment uses E5/Pokémon 5e with a fixed level-11 three-Pokémon roster and records actual win/loss. Either result can complete licensing; neither changes Rank or registers `RANK_B_TO_A`.

---

## M5_08_FIVE_CROSS_AGAIN

**Purpose:** A5_FIVE_CROSS: reunion causale dei Five.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Reuse class:** ADAPT

**Source archetypes:**
- R23_NPC_PRESENCE_SCHEDULE_GATE
- R28_FRIEND_DIVERGENCE_UPDATE
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** the first major Five reunion after prolonged independent careers.

**Implementation lock:** Scene `m05-five-cross-again` contains **15 nodes / 33 meaningful choices**. Physical friend branches require actual schedule presence at Altacima/Fulgore; all other participation remains remote/contextual. Completion writes `five_cross_complete` and hands off to the schedule-aware FRIEND_BEAT_05 selector without teleporting anyone.

---

## M5_09_FRIEND_BEAT_05

**Purpose:** beat personale obbligatorio dentro la reunion.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Reuse class:** ADAPT

**Source archetypes:**
- R26_FRIEND_BEAT_SELECTOR
- R27_FRIEND_BEAT_CONTENT
- R23_NPC_PRESENCE_SCHEDULE_GATE
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** DIFFICILE personal follow-up to the Five reunion, with friend-specific career themes and deeper cross-state callbacks.

**Implementation lock:** Scene `m05-friend-beat-05` contains **22 nodes / 48 meaningful choices**. The selected friend is persisted by the M5 selector; physical/remote paths remain distinct; relationship/result/context writes survive save/reload; no friend is forced into a fight or relocated solely to satisfy the beat.

---

## M5_10_HIGH_ALTITUDE_EVENT

**Purpose:** soccorso/competizione/lavoro ad alta quota con stato reale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Reuse class:** ADAPT

**Source archetypes:**
- R31_LOCAL_PROBLEM_RESPONSE
- R36_MULTI_MODAL_CONFLICT_RESOLUTION_LATTICE
- R35_CONDITIONAL_ALLY_CO_ACTION
- R32_WAIT_LET_TIME_PASS
- R03_SIMPLE_SKILL_CHECK

**Unique layer:** altitude rescue/support pressure where useful risk, retreat and credit attribution are all explicit.

**Implementation lock:** Scene `m05-high-altitude-event` contains **15 nodes / 32 meaningful choices**. It supports direct rescue, route stabilization, reporting, waiting and conditional Lance co-action. A failed check changes tactics instead of fabricating injury; support and direct rescue remain distinct persistent outcomes.

---

## M5_11_TRIAL_REGISTRATION

**Purpose:** eligibility B→A ad Altacima.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Reuse class:** REUSE

**Source archetypes:**
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO
- R17_PROMOTION_QUALIFIER_REGISTRATION

**Implementation lock:** Scene `m05-trial-registration` contains **14 nodes / 31 meaningful choices**. It synchronizes the canonical E5 checkpoint `RANK_B_TO_A`, requires Rank B and five real roster members, registers through `competition_trial_register`, and does not heal, clone or narratively lock a fake Official Five.

---

## M5_12_PROMOTION_TRIAL_B_A

**Purpose:** checkpoint RANK_B_TO_A, roster ufficiale 5.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Reuse class:** REUSE

**Source archetypes:**
- R18_PROMOTION_TRIAL_GATE_MATCH
- R06_COMBAT_HANDOFF
- R19_RANK_RESULT_NEXT_ACCESS

**Implementation lock:** Scene `m05-promotion-trial-b-a` contains **22 nodes / 48 meaningful choices**. It uses one fixed level-13 Official Five, ELITE difficulty and `promotion_trial` E5 metadata. Win promotes to Rank A through E5; loss preserves Rank B, consumes registration and leaves the checkpoint retryable. No invisible scaling or narrative promotion exists.

---

## M5_13_MASTERS_ENTRY

**Purpose:** A5_MASTERS_ENTRY dopo Rank A, senza sostituire il gate.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Reuse class:** ADAPT

**Source archetypes:**
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO
- R15_OFFICIAL_MATCH_LIFECYCLE
- R06_COMBAT_HANDOFF
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** Rank-A Masters seeding entry whose win/loss changes seeding but never geography or Rank.

**Implementation lock:** Scene `m05-masters-entry` contains **18 nodes / 40 meaningful choices**. The event requires the real A5 Masters window, can be deferred legally, and offers a fixed level-14 Official Five seeding match. Win/loss is recorded by E5 and maps to high/open seed bands without touching Rank A or future A→S.

---

## M5_14_MODULE_OUTCOME

**Purpose:** Rank A, licenza interregionale e handoff M6.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Reuse class:** REUSE

**Source archetypes:**
- R38_COMPOSITE_OUTCOME_CLASSIFIER
- R20_MODULE_EXIT_CONTRACT
- R21_MODULE_HANDOFF
- R33_CROSS_MODULE_CALLBACK

**Implementation lock:** Scene `m05-module-outcome` contains **14 nodes / 30 meaningful choices**. Its scene gate requires Rank A, Lance met, FRIEND_BEAT_05 complete, interregional license, persistent Ancient Trace and Masters Entry available or resolved. Only the final audited choice writes `m5_complete=true`, `m06_unlocked=true` and `m5_outcome_complete=true`; no roster/resource state is reset.


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

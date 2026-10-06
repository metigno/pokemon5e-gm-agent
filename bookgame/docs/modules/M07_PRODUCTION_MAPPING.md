# P5E LIBROGAME — M07 PRODUCTION MAPPING

**Module:** M07 — Sotto i Riflettori  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M07_SOTTO_I_RIFLETTORI_MODULE_DESIGN.md`  
**Purpose:** production map for converting M7 into validated offline story content  
**Locked authored budget:** **5,200 stitches / 3,200 player choices**

**Module implementation status:** **M7_00–M7_13 IMPLEMENTED / LIBRARY-V2 ALIGNED / STATIC-PASS — FINAL RUNTIME CI PENDING**

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
| M7_05_FRIEND_BEAT_07 | uno dei Four nella corsa al Mondiale in stato reale | 501 | 308 | IMPLEMENTED |
| M7_06_QUALIFIER_REGISTRATION | eligibility WORLD_QUALIFIER e roster ufficiale 6 | 449 | 276 | IMPLEMENTED |
| M7_07_WORLD_QUALIFIER | bracket reale; solo risultato effettivo può qualificare | 501 | 308 | IMPLEMENTED |
| M7_08_QUALIFIER_RESULT | qualificato o eliminato, history e conseguenze | 449 | 276 | IMPLEMENTED |
| M7_09_LAST_CHANCE_GATE | accesso solo se last_chance_eligible | 345 | 213 | IMPLEMENTED |
| M7_10_LAST_CHANCE | route finita, nessun retry infinito | 345 | 213 | IMPLEMENTED |
| M7_11_BEFORE_THE_LIGHTS | A7_BEFORE_LIGHTS per qualificati e amici disponibili | 345 | 212 | IMPLEMENTED |
| M7_12_WORLDS_MISSED | ramo completo per chi non si qualifica | 345 | 212 | IMPLEMENTED |
| M7_13_MODULE_OUTCOME | handoff M8 o WORLD_EXIT/M12 senza falsificare esiti | 294 | 181 | IMPLEMENTED |
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
- GitHub Actions runtime evidence: **PASS** on commit `0b0cf92fc00c22adb7126dfce9dc1372dd2889a7` (Bookgame Tests run `37450063293`).

Final **COMPLETE** remains reserved for executable runtime evidence.

## 2C. LIBRARY V2 ROUTING FOR CYCLE 2

- **M7_05:** R26 Friend Beat selector + R27 Friend Beat content + R23 schedule/location causality + R33 continuity. Physical contact requires the same real Meridiana location; otherwise the selected friend remains remote.
- **M7_06:** R16 eligibility information + R17 qualifier registration shell + R32 legal deferral + R33 callbacks. WORLD_QUALIFIER registration requires Rank S, the open A7 window and a real Official Six.
- **M7_07:** R37 multi-round tournament lifecycle + R06 combat handoff + R15 official match lifecycle. The main lane is two Official Six ELITE matches; a loss closes the lane and no internal retry is created.
- **M7_08:** R38 composite outcome classifier + R29 living-world consequence + R33 Anchor/Friend/media callbacks. `world_qualified` is written only after a bracket result produced by real E5 matches.
- **M7_09:** R34 access boundary + R16 eligibility information + R32 time/deferral + R38 routing classifier. A qualified run bypasses Last Chance; an eliminated run opens it only when `last_chance_eligible` and `A7_LAST_CHANCE` are both real.

**No R39 candidate is required.** Library V2 R01→R38 remains sufficient through M7_09.

### Cycle 2 validation status

- authored files: present;
- exact cycle budget: **90 nodes / 199 meaningful choices**;
- cumulative M7 runtime surface: **156 nodes / 344 choices**;
- exact remaining M7 target: **54 nodes / 118 choices**;
- canonical bindings authored: `A7_WORLD_QUALIFIER`, `A7_LAST_CHANCE`, `A7_BEFORE_LIGHTS`, plus deterministic `M7_FRIEND_BEAT_SELECT`;
- World Qualifier format: **Official Six / Singles / ELITE**, two-match lane in this instance;
- Rank S remains separate from qualification;
- no Promotion Trial misuse for WORLD_QUALIFIER (there is no post-S rank);
- Last Chance remains finite and separate from the main qualifier;
- dedicated regressions: `m07-cycle2.test.mjs` plus expanded `m07-cycle-budget.test.mjs`;
- GitHub Actions runtime evidence: **PASS** on commit `0b0cf92fc00c22adb7126dfce9dc1372dd2889a7` (Bookgame Tests run `37450063293`).

## 2D. LIBRARY V2 ROUTING FOR FINAL CYCLE

- **M7_10:** R37 multi-round/tournament lifecycle reduced to one finite decisive bracket node + R06 combat handoff + R15 official match lifecycle + R38 outcome classifier. A7_LAST_CHANCE is consumed once; there is exactly one E5 match and no retry loop.
- **M7_11:** R23 NPC presence/schedule gate + R27 friend content + R33 callback continuity + R21 module handoff. Only friends whose current schedules are present can be selected; physical dialogue requires the actual Grand Hall location.
- **M7_12:** R38 composite outcome classifier + R29 living-world off-screen resolution + R33 callbacks + R20 module exit contract. Worlds Missed is legal only after the main qualifier is resolved and no unconsumed Last Chance route remains.
- **M7_13:** R20 module exit contract + R21 module handoff + R38 route classifier + R33 continuity review. Qualified runs unlock M8 only; worlds-missed runs unlock M12 only.

**No R39 candidate is required.** R01→R38 covers the complete M7 topology.

### Final-cycle validation status

- exact cycle budget: **54 nodes / 118 meaningful choices**;
- complete M7 runtime surface: **210 nodes / 462 meaningful choices**;
- Last Chance: **one Official Six / Singles / ELITE E5 match**, finite, no replay loop;
- Before the Lights: schedule-causal friend availability, no NPC teleport;
- Worlds Missed: complete non-World route, preserving Rank S and career state;
- exit routing: **M8 iff world_qualified**, **M12 iff worlds_missed**;
- dedicated regressions: `m07-cycle3.test.mjs` plus final budget/reachability locks;
- final GitHub Actions runtime evidence: **PENDING**.

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



**Reuse class:** ADAPT

**Source archetypes:**
- R26_FRIEND_BEAT_SELECTOR
- R27_FRIEND_BEAT_CONTENT
- R23_NPC_PRESENCE_SCHEDULE_GATE
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** a late-career Four interaction under World-qualification pressure, with no forced Player-vs-Friend fight and no teleporting.

**Implementation lock (cycle 2):** Scene `m07-friend-beat-07` contains **20 nodes / 44 meaningful choices**. The selector rotates away from the protagonist and M6 friend when possible, physical mode requires a real shared Meridiana location, remote mode preserves the friend's schedule, and completion never grants ranking or qualification.

---

## M7_06_QUALIFIER_REGISTRATION

**Purpose:** eligibility WORLD_QUALIFIER e roster ufficiale 6.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.



**Reuse class:** ADAPT

**Source archetypes:**
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO
- R17_PROMOTION_QUALIFIER_REGISTRATION
- R32_WAIT_LET_TIME_PASS
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** WORLD_QUALIFIER registration is an administrative Rank S gate with Official Six, not a Promotion Trial and not a qualification result.

**Implementation lock (cycle 2):** Scene `m07-qualifier-registration` contains **18 nodes / 40 meaningful choices**. It checks Rank S, `A7_WORLD_QUALIFIER` availability and the actual six-member roster, persists registration, and leaves `world_qualified` untouched.

---

## M7_07_WORLD_QUALIFIER

**Purpose:** bracket reale; solo risultato effettivo può qualificare.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.



**Reuse class:** ADAPT

**Source archetypes:**
- R37_MULTI_ROUND_TOURNAMENT_LIFECYCLE
- R06_COMBAT_HANDOFF
- R15_FIRST_OFFICIAL_MATCH_LIFECYCLE
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO

**Unique layer:** the final World-qualification lane uses two Official Six ELITE matches in this instance; every advancement is driven by real E5 outcomes.

**Implementation lock (cycle 2):** Scene `m07-world-qualifier` contains **20 nodes / 44 meaningful choices**. Round 1 loss ends the main lane, Round 1 win opens the Qualifying Match, and the decisive result is recorded without directly setting `world_qualified`.

---

## M7_08_QUALIFIER_RESULT

**Purpose:** qualificato o eliminato, history e conseguenze.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.



**Reuse class:** ADAPT

**Source archetypes:**
- R38_COMPOSITE_OUTCOME_CLASSIFIER
- R29_LIVING_WORLD_OFF_SCREEN_RESOLUTION
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** qualification is classified from the already-resolved E5 lane, with public/friend/Cynthia consequences and finite Last Chance eligibility on elimination.

**Implementation lock (cycle 2):** Scene `m07-qualifier-result` contains **18 nodes / 40 meaningful choices**. Only a real qualified bracket result can set `world_qualified=true`; elimination remains persistent and opens `A7_LAST_CHANCE` only through explicit eligibility.

---

## M7_09_LAST_CHANCE_GATE

**Purpose:** accesso solo se last_chance_eligible.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.



**Reuse class:** ADAPT

**Source archetypes:**
- R34_ACCESS_BOUNDARY_RECONNAISSANCE_GATE
- R16_ROSTER_PREPARATION_ELIGIBILITY_INFO
- R32_WAIT_LET_TIME_PASS
- R38_COMPOSITE_OUTCOME_CLASSIFIER

**Unique layer:** a finite routing gate distinguishes already-qualified runs from legally eligible Last Chance runs without replaying the main Qualifier.

**Implementation lock (cycle 2):** Scene `m07-last-chance-gate` contains **14 nodes / 31 meaningful choices**. Qualified runs bypass the route, eliminated runs require both `last_chance_eligible` and `a7_last_chance_available`, and the block records only routing state for M7_10.

---

## M7_10_LAST_CHANCE

**Purpose:** route finita, nessun retry infinito.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.



**Reuse class:** ADAPT

**Source archetypes:**
- R37_MULTI_ROUND_TOURNAMENT_LIFECYCLE
- R06_COMBAT_HANDOFF
- R15_FIRST_OFFICIAL_MATCH_LIFECYCLE
- R38_COMPOSITE_OUTCOME_CLASSIFIER

**Unique layer:** a single finite Last Chance match that can qualify only through a real E5 win and cannot be retried.

**Implementation lock (final cycle):** Scene `m07-last-chance` contains **14 nodes / 31 meaningful choices**. It has exactly one Official Six ELITE combat handoff; win and loss consume the route permanently, and only the post-E5 win record can set `world_qualified=true`.

---

## M7_11_BEFORE_THE_LIGHTS

**Purpose:** A7_BEFORE_LIGHTS per qualificati e amici disponibili.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.



**Reuse class:** ADAPT

**Source archetypes:**
- R23_NPC_PRESENCE_SCHEDULE_GATE
- R27_FRIEND_BEAT_CONTENT
- R33_CROSS_MODULE_CALLBACK
- R21_MODULE_HANDOFF

**Unique layer:** the pre-World departure scene uses only actually present Four contacts and preserves the full no-reset state into M8.

**Implementation lock (final cycle):** Scene `m07-before-the-lights` contains **14 nodes / 31 meaningful choices**. Friend choices require current schedule presence, physical contact requires `meridiana_grand_hall`, and completion never creates draw, roster lock or future results.

---

## M7_12_WORLDS_MISSED

**Purpose:** ramo completo per chi non si qualifica.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.



**Reuse class:** ADAPT

**Source archetypes:**
- R38_COMPOSITE_OUTCOME_CLASSIFIER
- R29_LIVING_WORLD_OFF_SCREEN_RESOLUTION
- R33_CROSS_MODULE_CALLBACK
- R20_MODULE_EXIT_CONTRACT

**Unique layer:** a complete season branch for a player who misses Worlds, distinguishing no legal Last Chance from a played-and-lost Last Chance without resetting Rank S or career state.

**Implementation lock (final cycle):** Scene `m07-worlds-missed` contains **14 nodes / 30 meaningful choices**. It cannot open while an unused Last Chance route remains; completion writes `worlds_missed=true` and preserves the continuing Living World.

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



**Reuse class:** REUSE

**Source archetypes:**
- R20_MODULE_EXIT_CONTRACT
- R21_MODULE_HANDOFF
- R38_COMPOSITE_OUTCOME_CLASSIFIER
- R33_CROSS_MODULE_CALLBACK

**Unique layer:** M7's two-way canonical exit: World participant to M8, non-qualified player directly to WORLD_EXIT/M12.

**Implementation lock (final cycle):** Scene `m07-module-outcome` contains **12 nodes / 26 meaningful choices**. Qualified runs set `m08_unlocked=true` and never unlock M12; worlds-missed runs set `m12_unlocked=true` and never unlock M8. Both set `m7_complete=true` without resetting persistent state.

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

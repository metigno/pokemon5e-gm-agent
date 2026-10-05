# P5E LIBROGAME — M01→M12 REUSE FORECAST

**Status:** PLANNING / NOT RUNTIME AUTHORITY  
**Canonical runtime baseline reviewed:** `pokemon5e-digital-bookgame@acc19d4` (implemented through M2_07)  
**Existing proven library:** R01→R36 in `NODE_REUSE_CATALOG.md`  
**Purpose:** use the complete M01→M12 production maps to forecast which later blocks should reuse existing archetypes and which genuinely new node patterns may need to be promoted after implementation.

---

# 0. CORE RULE

A production-map block is **not** automatically a new node family.

For every future block:

1. compose it from R01→R36 first;
2. use ADAPT when local data/context differs;
3. introduce a new candidate only when the existing library cannot express the structural job cleanly;
4. do **not** promote a candidate into Rxx until an implemented module proves it in runtime/tests.

This forecast therefore uses:

- **REUSE** — R01→R36 already cover the structural job;
- **ADAPT** — existing archetypes cover the engine topology but local composition is substantial;
- **CANDIDATE** — likely new reusable node topology, pending implementation;
- **UNIQUE** — important authored event whose lower-level primitives may be reused, but which should not become a generic story template.

---

# 1. CANDIDATE ARCHETYPES FORECAST

These are **not yet official Rxx archetypes**.

## C01 — TIMED CRISIS / ESCALATION CLOCK

Likely first proof: **M3_06_FERROX_INCIDENT**.

```
CRISIS START
→ deadline/escalation clock begins
├─ player acts early
├─ player delays
├─ player leaves
└─ world/NPC actions occur
→ crisis phase changes
```

Difference from R29:
R29 proves the world moves off-screen. C01 would formalize a live crisis with explicit phase/timer escalation.

Later reuse:
- M5 high-altitude emergency
- M7 qualification deadlines where appropriate
- postgame emergencies

---

## C02 — RISK / RESOURCE RESCUE OPERATION

Likely first proof: **M3_07_FERROX_RESCUE**.

```
RESCUE
├─ target/priority A
├─ target/priority B
├─ safer/slower route
├─ faster/riskier route
├─ spend/use resource
└─ withdraw / delegate
→ aggregate rescue outcome
```

Tracks real:
- time;
- risk;
- resources;
- injuries/condition;
- rescued/lost targets;
- world damage.

Later reuse:
- M5 high-altitude event
- future disaster/field-response content.

---

## C03 — MUTUALLY EXCLUSIVE PRIORITY FORK

Likely first proof: **M3_09_CROSSROADS**.

The player cannot do everything before the world changes.

```
MULTIPLE VALID PRIORITIES
├─ choose A → B/C progress without player
├─ choose B → A/C progress without player
└─ choose C → A/B progress without player
```

Difference from normal route choice:
the unchosen options have persistent consequences rather than merely remaining available unchanged.

---

## C04 — MULTI-MATCH TOURNAMENT LIFECYCLE

Likely first proof: **M3_10_REGIONAL_CUP**.

Extends R15 from one official match to an event made of multiple scheduled matches/bracket rounds.

```
REGISTER / ELIGIBILITY
→ FIELD / BRACKET
→ MATCH
→ RESULT UPDATE
├─ eliminated
└─ advance → next match
→ final placement/history
```

Later reuse:
- M4 Upper Regional
- M6 Continental Cup
- M7 World Qualifier / Last Chance
- M9 groups (with C13 extension)
- M10/M11 knockout World stages.

Competition engine E5 remains authoritative; C04 is only the reusable node/content lifecycle around it.

---

## C05 — MULTI-AXIS OUTCOME AGGREGATOR

Likely first proof: **M3_11_RESCUE_OUTCOME**.

One event can finish with several independent persistent axes:

```
OUTCOME
= people/Pokémon result
+ infrastructure/world damage
+ evidence
+ reputation
+ NPC relationship
+ competition/career consequence
```

No single binary `resolved=true` should erase meaningful partial outcomes.

Later reuse:
- M4 smuggling/coastal consequences
- M7 qualifier consequences
- M9/M10/M11 tournament aftermath
- M12 World exit branch.

---

## C06 — ENVIRONMENTAL WINDOW GATE

Likely first proof: **M4_02_WEATHER_WINDOW**.

```
DESTINATION / ACTIVITY
├─ window open → proceed
└─ window closed / risky
   ├─ wait
   ├─ reroute
   ├─ accept increased risk if legal
   └─ abandon/postpone
```

Inputs can include:
- weather;
- tide;
- visibility;
- transport schedule;
- environmental danger.

Later reuse:
- M4 reef/coast
- M5 mountain weather/ascent.

Difference from R22:
R22 varies content by time-of-day. C06 makes a changing environment an actual access/risk constraint.

---

## C07 — LICENSE / REPUTATION / MILESTONE ACCESS UNLOCK

Likely first proof: **M4_10_MAJOR_NAME** or **M5_07_INTERREGIONAL_LICENSE**.

A durable career/world milestone opens services, routes or events without pretending it is Rank.

```
MILESTONE ACHIEVED
→ record entitlement/reputation/license
→ unlock legal access set
→ later checks read that entitlement
```

Later reuse:
- interregional travel;
- Masters entry;
- World professional access;
- post-World reputation.

---

## C08 — LONG-ARC MYSTERY LAYER

Likely first proof: **M5_06_ANCIENT_TRACE**, with payoff/extension in M6.

```
LAYER N DISCOVERED
→ evidence persists
→ no forced premature conclusion
→ later module reads previous layer
→ new layer becomes interpretable
```

Difference from R33/R30:
R33 is a callback and R30 aggregates evidence locally. C08 formalizes an investigation deliberately spanning multiple modules with staged interpretation.

---

## C09 — MULTI-NPC CONVERGENCE / REUNION

Likely first proof: **M5_08_FIVE_CROSS_AGAIN**.

Multiple autonomous NPC careers may causally converge in one place/event.

```
CHECK REAL SCHEDULES / ACCESS
→ determine who can be present
→ ensemble event
→ individual interactions
→ each NPC resumes persistent trajectory
```

Later reuse:
- M7 before the lights
- World Village
- M12 friend closure.

Difference from R26/R28:
R26 selects one friend. R28 shows divergence. C09 supports several persistent NPCs in one causally legal scene.

---

## C10 — CIRCUIT RANKING + CUTOFF SNAPSHOT

Likely first proof: **M6_04_MASTERS_CIRCUIT**, completed by **M6_13_WORLD_CUTOFF**.

```
EVENT RESULTS
→ ranking changes over time
→ deadline reached
→ snapshot/freeze eligibility inputs
→ later qualification reads frozen snapshot
```

Critical rule:
later results must not retroactively rewrite the eligibility snapshot if canon says the cutoff is fixed.

Later reuse:
- World qualification/seeding where applicable.

---

## C11 — MEDIA / PUBLIC REPUTATION INTERACTION

Likely first proof: **M7_03_MEDIA_SPONSOR**.

```
MEDIA / PUBLIC EVENT
→ player chooses response/action
→ record public/reputation/contract state
→ later presentation/access/relationship may react
```

Rules:
- never force protagonist dialogue;
- no illegal stat bonus merely because of sponsorship;
- reputation is not a substitute for competition results.

Later reuse:
- M8 Media Day
- M9 interday media
- M12 post-World reputation.

---

## C12 — FORMAL CREDENTIAL / INSPECTION / ROSTER LOCK

Likely first proof: **M8_01_ACCREDITATION → M8_03_REGISTRATION**.

```
FORMAL CHECKPOINT
→ inspect canonical state
├─ invalid → explain/reject without mutating into legality
└─ valid
   → issue credential / accept registration
   → snapshot or lock required data
```

Examples:
- accreditation;
- medical control;
- official World roster lock.

Difference from R16/R17:
those cover eligibility and promotion registration. C12 formalizes institutional state inspection and immutable/snapshotted tournament inputs.

---

## C13 — DRAW / STANDINGS / BRACKET LOCK TRANSITION

Likely first proof: **M8_10_WORLD_DRAW**, then M9.

```
REAL FIELD
→ seed/draw
→ lock groups/schedule
→ play scheduled matches
→ update standings
→ apply tiebreaks
→ lock qualifiers
→ generate knockout crossings
```

Later reuse:
- M9 group stage
- M10 R16/QF
- M11 Final Four.

This should consume E5 outputs, not recreate tournament math in narrative flags.

---

## C14 — POSTGAME CALLBACK SWEEP / FREE-ROAM COMPLETION

Likely first proof: **M12_00→M12_11**.

```
READ WHOLE CAMPAIGN HISTORY
→ branch by World result
→ revisit selected persistent consequences
→ resolve/continue relationships and regional states
→ unlock postgame hooks
→ mark main story complete
→ keep world/save/free-roam alive
```

This is broader than a normal module exit and broader than one R33 callback.

---

# 2. MODULE-BY-MODULE FORECAST

## M01 — LE PRIME STRADE

**Role:** foundation.

Already produced the base library R01→R32.

No forecast required.

---

## M02 — SOTTO LA NEBBIA

Implemented through M2_07.

### Proven/promoted
- R33 CROSS-MODULE CALLBACK
- R34 ACCESS BOUNDARY / RECONNAISSANCE GATE
- R35 CONDITIONAL ALLY CO-ACTION
- R36 MULTI-MODAL CONFLICT RESOLUTION LATTICE

### M2_08 onward forecast

| Block | Expected classification | Existing/candidate pieces |
|---|---|---|
| M2_08 FRIEND_BEAT_02 | REUSE/ADAPT | R23, R26, R27 |
| M2_09 ROOKIE_INVITATIONAL | CANDIDATE until M3 proves/generalizes tournament lifecycle | C04, R15 |
| M2_10 CRISIS_MOVES | REUSE/ADAPT | R29, possibly early C01 |
| M2_11 NETWORK_OUTCOME | REUSE/ADAPT | R36, possibly C05 |
| M2_12 TRIAL_REGISTRATION | REUSE | R16, R17 |
| M2_13 PROMOTION_TRIAL | REUSE/ADAPT | R18, R06 |
| M2_14 TRIAL_RESULT | REUSE | R19, R20, R21 |

M2 should not invent a separate Friend, Trial or competition engine.

---

## M03 — FERRO, POLVERE E PRESSIONE

| Block | Classification | Reuse/new |
|---|---|---|
| M3_00 Rank D handoff | REUSE | R21, R33 |
| M3_01 Cava Grigia | REUSE/ADAPT | R01, R07, R29 |
| M3_02 Ferravia arrival | REUSE/ADAPT | R02, R12, R13, R14 |
| M3_03 Old Maps | ADAPT | R03, R04, R30 |
| M3_04 Steven enters | ADAPT/UNIQUE | R24, R25 |
| M3_05 Tunnel warnings | ADAPT | R30, R29 |
| M3_06 Ferrox incident | **CANDIDATE** | C01 |
| M3_07 Ferrox rescue | **CANDIDATE** | C02 + R36 |
| M3_08 Friend Beat 03 | REUSE/ADAPT | R26, R27 |
| M3_09 Crossroads | **CANDIDATE** | C03 |
| M3_10 Regional Cup | **CANDIDATE** | C04 |
| M3_11 Rescue outcome | **CANDIDATE** | C05 |
| M3_12 Trial registration | REUSE | R16, R17 |
| M3_13 Promotion Trial | REUSE/ADAPT | R18 |
| M3_14 Trial result | REUSE | R19, R20, R21 |

**Expected genuinely new families:** C01–C05.

---

## M04 — SALE, VENTO E MAREA

| Block | Classification | Reuse/new |
|---|---|---|
| M4_00 Rank C handoff | REUSE | R21, R33, C05 |
| M4_01 Mareasale arrival | REUSE/ADAPT | R02, R12, R13, R14, R23 |
| M4_02 Weather Window | **CANDIDATE** | C06 |
| M4_03 Archie enters | ADAPT/UNIQUE | R24, R25 |
| M4_04 Port Pressure | ADAPT | R10, R11, R29, R30 |
| M4_05 Coast Route | REUSE/ADAPT | R01, R07, R22 |
| M4_06 Reef Access | REUSE/ADAPT | R34 + C06 |
| M4_07 Smuggling Thread | ADAPT | R30, R36, C05 |
| M4_08 Friend Beat 04 | REUSE/ADAPT | R26, R27 |
| M4_09 League Registration | REUSE after C04 | C04 |
| M4_10 Major Name | **CANDIDATE** | C07 |
| M4_11 Upper Regional | REUSE after C04 | C04 |
| M4_12 Trial registration | REUSE | R17 |
| M4_13 Promotion Trial | REUSE | R18 |
| M4_14 After League | REUSE/ADAPT | C05, R19, R20, R21 |

**Expected genuinely new families:** C06, C07.

---

## M05 — SOPRA LE NUVOLE

| Block | Classification | Reuse/new |
|---|---|---|
| M5_00 Rank B handoff | REUSE | R21, R33 |
| M5_01 Mountain approach | REUSE after C06 | R01, C06 |
| M5_02 Altacima | REUSE/ADAPT | R02, R13, R14 |
| M5_03 Lance enters | ADAPT/UNIQUE | R24, R25 |
| M5_04 Weather decisions | REUSE after C06 | C06 |
| M5_05 Fulgore ascent | REUSE/ADAPT | R34, C06 |
| M5_06 Ancient Trace | **CANDIDATE** | C08 |
| M5_07 Interregional License | REUSE/ADAPT after C07 | C07 |
| M5_08 Five Cross Again | **CANDIDATE** | C09 |
| M5_09 Friend Beat 05 | REUSE/ADAPT | R27 + C09 context |
| M5_10 High Altitude Event | REUSE after M3 | C01, C02, C05 |
| M5_11 Trial registration | REUSE | R17 |
| M5_12 Promotion Trial | REUSE | R18 |
| M5_13 Masters Entry | REUSE after C07/C04 | C07, C04 |
| M5_14 Module outcome | REUSE | R19, R20, R21 |

**Expected genuinely new families:** C08, C09.

---

## M06 — OLTRE I CONFINI

| Block | Classification | Reuse/new |
|---|---|---|
| M6_00 Rank A handoff | REUSE | R21, R33 |
| M6_01 Route Selection | REUSE | R01, R02 |
| M6_02 Interregional Travel | REUSE/ADAPT | R01, C07 |
| M6_03 Red enters | ADAPT/UNIQUE | R24, R25 |
| M6_04 Masters Circuit | **CANDIDATE** | C10 + C04 |
| M6_05 Hidden Trajectories | REUSE/ADAPT | R28, R33 |
| M6_06 Friend Beat 06 | REUSE/ADAPT | R26, R27 |
| M6_07 Continental Entry | REUSE after C04/C07 | C04, C07 |
| M6_08 Continental Cup | REUSE after C04 | C04 |
| M6_09 Ancient Layer Two | REUSE after C08 | C08 |
| M6_10 First Lighthouse Return | REUSE/ADAPT | C08, R33, R34 |
| M6_11 Trial registration | REUSE | R17 |
| M6_12 Promotion Trial | REUSE | R18 |
| M6_13 World Cutoff | **CANDIDATE** | C10 |
| M6_14 Module outcome | REUSE | R19, R20, R21 |

**Expected genuinely new family:** C10.

---

## M07 — SOTTO I RIFLETTORI

| Block | Classification | Reuse/new |
|---|---|---|
| M7_00 Rank S handoff | REUSE | R21 |
| M7_01 Meridiana arrival | REUSE/ADAPT | R02, R12, R13, R14 |
| M7_02 Cynthia enters | ADAPT/UNIQUE | R24, R25 |
| M7_03 Media Sponsor | **CANDIDATE** | C11 |
| M7_04 Pro Preparation | REUSE/ADAPT | existing service/rules infrastructure |
| M7_05 Friend Beat 07 | REUSE/ADAPT | R26, R27 |
| M7_06 Qualifier Registration | REUSE after C04/C10 | C04, C10 |
| M7_07 World Qualifier | REUSE after C04 | C04 |
| M7_08 Qualifier Result | REUSE/ADAPT | C05, C04 |
| M7_09 Last Chance Gate | REUSE/ADAPT | R16, R34, C10 |
| M7_10 Last Chance | REUSE after C04 | C04 |
| M7_11 Before the Lights | REUSE/ADAPT | C09, R27 |
| M7_12 Worlds Missed | REUSE/ADAPT | C05, R20 |
| M7_13 Module Outcome | REUSE | R20, R21 |

**Expected genuinely new family:** C11.

---

## M08 — IL MONDO NELLO STESSO POSTO

| Block | Classification | Reuse/new |
|---|---|---|
| M8_00 World Arrival | REUSE/ADAPT | R01, C07 |
| M8_01 Accreditation | **CANDIDATE** | C12 |
| M8_02 Medical Control | **CANDIDATE / same family** | C12 |
| M8_03 Registration / roster lock | **CANDIDATE / same family** | C12 |
| M8_04 World Village | REUSE/ADAPT | R02, R23, C09 |
| M8_05 Astrid enters | ADAPT/UNIQUE | R24, R25 |
| M8_06 Friend Beat 08 | REUSE/ADAPT | R27, C09 |
| M8_07 Training Hall | REUSE | R05 + existing training rules |
| M8_08 Media Day | REUSE after C11 | C11 |
| M8_09 Opening Ceremony | UNIQUE | low-level state reads only |
| M8_10 World Draw | **CANDIDATE** | C13 |
| M8_11 Group Reveal | **CANDIDATE / same family** | C13 |

**Expected genuinely new families:** C12, C13.

---

## M09 — TRE PARTITE PER RESTARE

Once C04 and C13 exist, most of M9 is composition rather than invention.

| Block | Classification | Reuse/new |
|---|---|---|
| M9_00 Groups Open | REUSE | C13 |
| M9_01 Matchday One | REUSE | C04, R15 |
| M9_02 Interday One | REUSE/ADAPT | R13, R29, C11 |
| M9_03 Kaia Thread | ADAPT/UNIQUE | R23, R24 |
| M9_04 Matchday Two | REUSE | C04, C13 |
| M9_05 Friend Beat 09 | REUSE/ADAPT | R27 + real competition state |
| M9_06 Interday Two | REUSE/ADAPT | C13, C05, C11 |
| M9_07 Matchday Three | REUSE | C04, C13 |
| M9_08 Group Resolution | REUSE after C13 | C13 |
| M9_09 Eliminated Route | REUSE/ADAPT | C05, R20 |
| M9_10 Advance Route | REUSE | C13, R21 |

**Expected genuinely new families:** none if C13 is designed correctly.

---

## M10 — NESSUNA SECONDA POSSIBILITÀ

| Block | Classification | Reuse/new |
|---|---|---|
| M10_00 R16 Bracket | REUSE | C13 |
| M10_01 Silas Thread | ADAPT/UNIQUE | R23, R24 |
| M10_02 R16 Prep | REUSE/ADAPT | R13, R16 |
| M10_03 World R16 | REUSE | C04 |
| M10_04 R16 Aftermath | REUSE | C05, C13 |
| M10_05 Friend Beat 10 | REUSE/ADAPT | R27 + C13 |
| M10_06 QF Prep | REUSE | R13, R16 |
| M10_07 World QF | REUSE | C04 |
| M10_08 QF Aftermath | REUSE | C05, C13 |
| M10_09 Module Outcome | REUSE | R20, R21 |

**Expected genuinely new families:** none.

---

## M11 — PER DIVENTARE CAMPIONE

| Block | Classification | Reuse/new |
|---|---|---|
| M11_00 Final Four Lock | REUSE | C13 |
| M11_01 Rei Thread | ADAPT/UNIQUE | R23, R24 |
| M11_02 SF Prep | REUSE | R13, R16 |
| M11_03 World SF | REUSE | C04 |
| M11_04 Other SF | REUSE | C13, R29 |
| M11_05 Friend Beat 11 | REUSE/ADAPT | R27, C09 |
| M11_06 Final Prep | REUSE | R13, R16 |
| M11_07 World Final | REUSE | C04 |
| M11_08 Championship Outcome | REUSE | C05, R20 |

**Expected genuinely new families:** none.

---

## M12 — DOPO IL MONDO

| Block | Classification | Reuse/new |
|---|---|---|
| M12_00 World Exit Branch | REUSE/ADAPT | C05, R20 |
| M12_01 Return Asteria | REUSE/ADAPT | R01, R33, C07 |
| M12_02 Valedarsena callbacks | REUSE, large-scale | R33 |
| M12_03 Bruma callbacks | REUSE, large-scale | R33 |
| M12_04 Ferrox callbacks | REUSE, large-scale | R33, C05 |
| M12_05 Coast callbacks | REUSE, large-scale | R33, C05 |
| M12_06 Highlands callbacks | REUSE, large-scale | R33, C08 |
| M12_07 Interregional callbacks | REUSE, large-scale | R33, C10 |
| M12_08 Meridiana callbacks | REUSE, large-scale | R33, C11 |
| M12_09 Friend Beat 12 | ADAPT | C09, R27 |
| M12_10 Postgame Hooks | **CANDIDATE** | C14 |
| M12_11 Main Story Complete | **CANDIDATE / same family** | C14 |

**Expected genuinely new family:** C14.

---

# 3. EXPECTED LIBRARY GROWTH

If this forecast is correct, the reusable library should evolve roughly as follows:

```
M01      → R01–R32 foundation
M02_01–07→ R33–R36 proven
M02 rest → likely little/no fundamental growth
M03      → crisis/rescue/tournament/outcome patterns
M04      → environmental gates + career milestone
M05      → long mystery + ensemble reunion
M06      → circuit ranking/cutoff
M07      → media/public reputation
M08      → formal World locks + draw/standings
M09      → mostly reuse
M10      → mostly reuse
M11      → mostly reuse
M12      → postgame/callback sweep
```

The important expected curve is:

**new archetypes should decrease sharply as production advances.**

Late modules should be difficult because of state density and competition stakes, not because they invent dozens of new node systems.

---

# 4. FORECAST SUMMARY

From the complete M01→M12 structure, only **14 additional reusable families** currently appear plausibly necessary beyond the proven R01→R36.

That is a planning ceiling, not a target.

We should actively try to implement each future block with existing Rxx first. A candidate should disappear from this list if implementation proves it is merely a composition of existing archetypes.

Therefore:

```
DO NOT FORCE EVERY MODULE TO ADD NEW NODE TYPES.
```

A module that adds **zero** new reusable archetypes can be perfectly designed.

---

# 5. PRODUCTION CONTRACT FOR FUTURE MODULES

Before Claude implements a block:

```
1. Read NODE_REUSE_CATALOG.md.
2. Read this forecast.
3. List the block's required structural jobs.
4. Map each job to an existing Rxx.
5. If no Rxx is sufficient, cite the relevant Cxx candidate.
6. Implement with local IDs/state.
7. Run regressions.
8. Only after runtime proof propose promoting Cxx → next Rxx.
```

Required block note example:

```
REUSE
- R03 skill check
- R04 evidence flag
- R29 living-world progression

CANDIDATE UNDER TEST
- C01 timed crisis escalation

UNIQUE CONTENT
- Ferrox tunnel collapse context
```

This keeps the library empirical instead of speculative.

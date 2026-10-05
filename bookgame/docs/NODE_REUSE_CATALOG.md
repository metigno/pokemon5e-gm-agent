# P5E LIBROGAME — NODE REUSE CATALOG V1

**Status:** STRUCTURAL PRODUCTION STANDARD  
**Source base:** M01 — Le Prime Strade, with promoted reusable deltas from later modules  
**Purpose:** reuse proven node structures while M02→M12 are produced without final screenplay.

---

# 0. PRINCIPLE

M01 is the first complete structural module and becomes the reference library for later modules.

Reuse does **not** mean copying story text.

Every node family belongs to one of three classes:

- **REUSE** — structure and engine behavior can be reused almost directly through parameters.
- **ADAPT** — topology/engine pattern is reusable, but local content, state, cast, encounter data or consequences must change.
- **UNIQUE** — the scene's dramatic purpose is specific and must be authored for that module; only lower-level primitives may be reused.

A UNIQUE scene can still contain REUSE primitives such as checks, combat handoffs, time costs, quest updates and result branches.

---

# 1. HARD RULES

## 1.1 Reuse structure, never foreign state

Never copy M01-specific state IDs into later modules unless they are intentionally global.

Examples that must not leak:
- `m1_world_pressure_state`
- `houndour_ginestre_*`
- `blue_m1_*`
- `friend_beat_01_*`
- M01 quest IDs
- M01 encounter IDs

## 1.2 Reuse engine contracts

The following may be preserved when appropriate:
- condition shape;
- effect type;
- check flow;
- combat handoff flow;
- quest lifecycle;
- schedule gate pattern;
- world-event progression pattern;
- result branch shape;
- save/persistence expectations;
- idempotence tests.

## 1.3 No blind copy/paste

Any reused node must explicitly define:
- owning module;
- owning location;
- input state;
- output state;
- local IDs;
- local cast;
- local consequence;
- local tests.

## 1.4 Story identity is never parameter-only

Changing only:
- city name;
- NPC name;
- species name;

is insufficient for an ADAPT/UNIQUE narrative block if the conflict is supposed to be distinct.

---

# 2. M01 INVENTORY BASELINE

Current M01 authored structural surface:

- **202 nodes**
- **463 choices**
- **17 check choices**
- **26 combat choices**
- **4 ecology selector choices**

Observed effect use in M01:
- `set_flag`
- `npc_state_set`
- `set_location`
- `npc_relationship_adjust`
- `quest_offer`
- `quest_start`
- `quest_complete`
- `quest_fail`
- `friend_beat_select`
- `npc_register`
- `purchase_item`
- `competition_trial_register`
- `competition_trial_available`
- `npc_schedule_set`

M01 is therefore large enough to serve as the structural reference rather than a theoretical prototype.

---

# 3. REUSE ARCHETYPES

## R01 — LOCATION ENTRY / RETURN

**Class:** REUSE  
**M01 examples:** city/service/farm/road return nodes.

### Shape

```
ENTRY
├─ inspect / info
├─ service / interaction
├─ local hook
└─ leave / return
```

### Parameters
- `moduleId`
- `locationId`
- destination gotos
- time cost
- discovery flag if required

### Reuse for
Every module.

---

## R02 — HUB NAVIGATION

**Class:** REUSE → ADAPT LOCAL  
**M01 example:** `m01-valedarsena-first-arrival#city_hub`

### Shape

```
HUB
├─ service A
├─ service B
├─ arena/event
├─ job/rumour
├─ local exploration
└─ leave
```

### Reuse
Navigation and conditional availability.

### Adapt
- layout;
- services;
- local events;
- transport exits;
- rank restrictions.

---

## R03 — SIMPLE SKILL CHECK

**Class:** REUSE  
**M01 examples:** Perception / Animal Handling branches.

### Shape

```
FICTIONAL ACTION
→ check
├─ success → authored consequence
└─ failure → authored consequence
```

### Parameters
- ability;
- skill;
- DC;
- success node;
- failure node;
- effects.

### Rule
Failure must remain valid; never secretly convert failure into success.

---

## R04 — CHECK + INFORMATION FLAG

**Class:** REUSE  
**M01 examples:** road clue, farm evidence, crossroads tracks.

### Shape
Check success reveals information and writes a knowledge/evidence state.

### Parameters
- evidence ID;
- knowledge flag;
- local consequence.

Useful in investigation-heavy M02/M03/M04 and beyond.

---

## R05 — OPTIONAL SPARRING

**Class:** REUSE  
**M01 examples:** rookie sparring, Blue sparring, Friend Beat arena sparring.

### Shape

```
OFFER
├─ accept
│  → ready
│  → combat handoff
│     ├─ win
│     ├─ loss
│     └─ withdraw if legal
└─ decline
```

### Parameters
- opponent trainer/NPC;
- registered Pokémon;
- format;
- relationship/result effects;
- return point.

### Rule
No scripted winner.

---

## R06 — COMBAT HANDOFF

**Class:** REUSE CORE  
**M01 examples:** all trainer/wild combat nodes.

### Shape

```
authored scene
→ combat object
→ engine
→ returnNodes
```

### Common outcomes
- win
- lose
- captured for legal wild encounters
- withdrawn where supported

### Rule
Do not duplicate battle mechanics in scene state.

---

## R07 — WILD OBSERVATION REQUEST

**Class:** REUSE  
**M01 examples:** AST-GINESTRE, AST-FARM, VAL-CITY requests.

### Shape

```
observe area
→ ecology request
├─ no encounter
└─ species result
```

### Parameters
- zone;
- habitat;
- method;
- allowed species;
- return nodes;
- time.

---

## R08 — WILD ENCOUNTER BEHAVIOR

**Class:** ADAPT  
**M01 examples:** Wooloo, Shinx, Hisuian Growlithe, Houndour.

### Common skeleton

```
ANIMAL PRESENT
├─ leave
├─ observe/check
│  ├─ improved read
│  └─ tension/uncertainty
└─ engage
   → combat
```

### Must adapt
- species behavior;
- habitat;
- social structure;
- escape behavior;
- reason for presence;
- danger.

Species are not cosmetic substitutions.

---

## R09 — WILD COMBAT RESULT

**Class:** REUSE CORE

### Shape
- win → persistent battle result, return
- loss → persistent battle consequences, return/recovery path
- captured → roster update from resolver, return

### Rule
Narrative later changes; engine contract does not.

---

## R10 — TEMPORAL JOB BOARD

**Class:** REUSE  
**M01 example:** Valedarsena Job Board.

### Shape

```
BOARD
├─ available job → offer/accept
├─ active job → inspect
├─ taken by NPC → consequence
├─ expired → consequence
└─ new/updated notice
```

### Parameters
- jobs;
- expiry;
- deadline;
- rewards;
- resolving NPC/world actor;
- local notices.

Excellent candidate for all inhabited hubs.

---

## R11 — QUEST LIFECYCLE

**Class:** REUSE CORE

### Standard states
- available
- active
- completed
- failed
- expired where supported

### Reuse
- offer;
- start;
- completion;
- deadline;
- world resolution;
- callback.

### Adapt
Objective and consequence.

---

## R12 — SHOP / MARKET

**Class:** REUSE CORE → ADAPT INVENTORY  
**M01 example:** Trainer Shop.

### Shape

```
SHOP ENTRY
├─ inspect inventory
├─ buy
├─ info
└─ leave
```

### Parameters
- merchant;
- inventory;
- prices;
- availability;
- rank/time restrictions.

Same structure may power marts, specialized trainer shops and event vendors.

---

## R13 — MEDICAL / POKÉMON CENTER SERVICE

**Class:** REUSE CORE  
**M01 source:** Valedarsena Center as service shell; full treatment mechanics remain engine-owned.

### Shape

```
CENTER
├─ treatment / healing action
├─ condition/status info
├─ local information
└─ leave
```

### Parameters
- service NPC;
- opening conditions;
- cost if applicable;
- legal medical actions;
- local information.

Narrative identity may change; service logic should not.

---

## R14 — ARENA RECEPTION

**Class:** REUSE  
**M01 example:** Arena front.

### Shape
- view activity;
- official opportunity;
- roster preparation;
- trial registration;
- local NPC overlap;
- leave.

Later hubs can reuse this without rebuilding competition navigation.

---

## R15 — FIRST/OFFICIAL MATCH LIFECYCLE

**Class:** REUSE CORE

### Shape

```
MATCH OFFER
├─ defer
└─ accept
   → combat
   ├─ win
   └─ loss
→ history/result callback
```

### Parameters
- competition ID;
- opponent;
- roster size;
- stakes;
- format;
- eligibility.

---

## R16 — ROSTER PREPARATION / ELIGIBILITY INFO

**Class:** REUSE

M01 demonstrates a node that explains what the player lacks without solving the requirement automatically.

### Reuse for
- Trial roster size;
- competition registration;
- travel permissions;
- Rank-gated events;
- later World eligibility.

### Rule
Never create a gift/loan/shortcut solely to satisfy the gate.

---

## R17 — PROMOTION / QUALIFIER REGISTRATION

**Class:** REUSE CORE → ADAPT RULESET

### Shape

```
ELIGIBILITY
├─ not eligible → exact reason / return
└─ eligible
   → register
   → prepare/postpone
   → gate call
```

### Parameters
- rank;
- competition checkpoint;
- roster requirements;
- deadline;
- venue.

---

## R18 — PROMOTION TRIAL / GATE MATCH

**Class:** ADAPT

### Reusable
- registration;
- call;
- battle lifecycle;
- retry;
- result persistence.

### Must adapt
- examiner;
- opponent roster;
- difficulty;
- venue;
- thematic identity;
- stakes.

---

## R19 — RANK RESULT / NEXT ACCESS

**Class:** REUSE CORE

### Shape

```
RESULT
├─ loss → retain state / retry access
└─ win → rank update / new access
```

No module reset.

---

## R20 — MODULE EXIT CONTRACT

**Class:** REUSE

### Shape

```
CHECK MODULE EXIT
├─ required beats missing → remain in live world
└─ contract satisfied → mark module complete + unlock next
```

### Adapt
Mandatory beats and next module ID.

### Rule
Rank/progression alone must not fabricate missing mandatory narrative/world beats.

---

## R21 — MODULE HANDOFF

**Class:** REUSE

Small transition layer from completed module into next unlocked module.

Parameters:
- previous completion;
- next unlock;
- rank/phase requirement;
- starting access points.

---

## R22 — TIME-OF-DAY VARIANT

**Class:** REUSE  
**M01 example:** Ginestre morning/afternoon/evening/night nodes.

### Reuse
Dispatch/conditions.

### Adapt
- visible activity;
- NPC presence;
- wildlife;
- service availability;
- travel risk.

---

## R23 — NPC PRESENCE / SCHEDULE GATE

**Class:** REUSE CORE

M01 uses real NPC schedule/location state to make encounters causal.

### Shape

```
if NPC present at location
→ expose interaction
else
→ no interaction
```

Use across all modules.

---

## R24 — PERSISTENT NPC FIRST MEETING

**Class:** ADAPT  
**M01 example:** Blue.

### Reusable structure
- causal context;
- talk;
- ignore;
- competitive/social alternative;
- information;
- leave;
- first-meeting persistence;
- no replay of first introduction.

### Must adapt
- NPC voice;
- motive;
- relationship logic;
- location contexts;
- optional conflict.

Ideal for module Anchor introductions but not a text template.

---

## R25 — MULTI-CONTEXT ANCHOR INTRO

**Class:** ADAPT

M01 Blue proves the same persistent NPC may be first encountered in several legal contexts.

### Reuse
Context dispatch and idempotence.

### Adapt
Each context must make sense for the Anchor.

---

## R26 — FRIEND BEAT SELECTOR

**Class:** REUSE CORE  
**M01 example:** `friend_beat_select`.

### Reusable inputs
- actual presence;
- location;
- compatible activity;
- recent result;
- relationship;
- deterministic tie-break.

### Output
- selected friend ID;
- selected beat type.

---

## R27 — FRIEND BEAT CONTENT

**Class:** ADAPT / UNIQUE depending on importance

### Reusable skeleton

```
SELECT FRIEND
→ friend-specific context
├─ shared activity
├─ information exchange
├─ optional fight
└─ brief interaction
→ write persistent result
```

### Must adapt
- voice;
- reason for presence;
- career state;
- activity;
- relationship consequence.

---

## R28 — FRIEND DIVERGENCE / UPDATE

**Class:** ADAPT  
**M01 example:** Five Roads.

### Reusable idea
Show friends continuing independent careers and persist their updated schedules/results.

### Must adapt
Their actual trajectories.

Do not clone the same “everyone leaves” beat every module.

---

## R29 — LIVING WORLD OFF-SCREEN RESOLUTION

**Class:** REUSE CORE

M01 proves that a world problem/job may resolve while the player does something else.

### Shape

```
world event open
→ time/world progresses
├─ player intervenes
├─ NPC resolves
├─ expires
└─ worsens/changes
```

Use heavily across M02→M12.

---

## R30 — INVESTIGATION / EVIDENCE AGGREGATION

**Class:** ADAPT  
**M01 example:** Ranger Elio + local pressure reports.

### Reusable
- collect independent evidence;
- partial knowledge;
- report/compare;
- local response;
- later verification.

### Must adapt
- evidence;
- responsible NPC;
- true explanation;
- consequences.

---

## R31 — LOCAL PROBLEM RESPONSE

**Class:** ADAPT

M01 local ecology response:
- investigate;
- contribute locally;
- verify;
- distinguish local improvement from global resolution.

Useful beyond ecology:
- industrial accidents;
- port problems;
- weather;
- transport;
- public events.

---

## R32 — WAIT / LET TIME PASS

**Class:** REUSE CORE

A legal choice may advance time without forcing activity.

Required for a living world.

---

# 4. UNIQUE FAMILIES

These must **not** become generic copied scenes.

## U01 — GAME INTRO
Character selection, The Five opening, starter establishment.

## U02 — MODULE CENTRAL CONFLICT
M01 ecology/logistics pressure, M02 poaching network, etc.

## U03 — ANCHOR CHARACTER DRAMA
Blue/N/Steven/Archie/Lance/Red/Cynthia/etc. personality-specific content.

## U04 — MAJOR FRIEND MOMENT
Important relationship/reunion/personal career beats.

## U05 — REVELATION
Any scene whose value depends on new information.

## U06 — CLIMACTIC SET PIECE
Major rescue, final confrontation, World knockout stage, etc.

## U07 — PERSONAL EVOLUTION / CAREER PAYOFF
Meaningful evolutions, long-term callbacks, major wins/losses.

---

# 5. REUSE DECISION TEST

Before writing a new node in M02→M12:

### Question 1
Does M01 already contain the same **engine job**?

If yes, start from REUSE.

### Question 2
Does only location/cast/data change while the topology stays stable?

If yes, use ADAPT.

### Question 3
Would copying the scene make two modules feel like the same story with renamed nouns?

If yes, classify UNIQUE or heavily ADAPT.

### Question 4
Can a UNIQUE scene be built from existing REUSE primitives?

Usually yes.

---

# 6. REQUIRED PRODUCTION TAG

For new block mapping, use one classification:

```
Reuse class: REUSE
Source archetype: R10_TEMPORAL_JOB_BOARD
```

or

```
Reuse class: ADAPT
Source archetypes:
- R24_PERSISTENT_NPC_FIRST_MEETING
- R25_MULTI_CONTEXT_ANCHOR_INTRO
Unique content:
- N/Zorua moral conflict
```

or

```
Reuse class: UNIQUE
Reusable primitives:
- R03_SIMPLE_SKILL_CHECK
- R06_COMBAT_HANDOFF
- R23_NPC_PRESENCE_GATE
```

This makes reuse explicit and auditable.

---

# 7. TEST REUSE

Structural reuse should also reuse regression families.

Examples:

## Shop template
Test:
- invalid purchase;
- valid purchase;
- money update;
- inventory update;
- save/reload.

## Job Board template
Test:
- offer;
- accept;
- expiry;
- taken by NPC;
- no duplicated reward;
- save/reload.

## Combat template
Test:
- legal handoff;
- all supported results;
- no narrative winner;
- persistent post-battle state.

## NPC first meeting
Test:
- all legal contexts;
- first meeting idempotence;
- ignore path valid;
- schedule respected;
- save/reload.

## Module exit
Test:
- each mandatory beat individually missing;
- complete contract;
- no reset of prior state.

Do not duplicate test design manually when an archetype already defines it.

---

# 8. TARGET EFFECT

M02→M12 should increasingly be assembled as:

```
PROVEN REUSE PRIMITIVES
+ LOCAL ADAPTATIONS
+ UNIQUE MODULE CONTENT
```

not:

```
NEW MODULE
= REBUILD EVERYTHING
```

M01 remains the first structural reference, but later modules may improve an archetype. If a later implementation becomes clearly superior and remains generic, promote that pattern into a newer catalog version rather than keeping M01 forever as an artificial limitation.


---

# 9. PROMOTED DELTAS FROM M02_05→M02_07

Reviewed against canonical branch commit `acc19d4`.

These blocks add **38 nodes / 73 choices**:
- `m02-ranger-thread.json` — 10 nodes / 20 choices
- `m02-marsh-approach.json` — 10 nodes / 15 choices
- `m02-poaching-network.json` — 18 nodes / 38 choices

Most of their structure is already expressible through R01–R32. Only the following patterns are promoted as genuinely reusable additions.

## R33 — CROSS-MODULE CALLBACK

**Class:** REUSE / ADAPT

**M02 example:** Ranger Elio can connect current Mistwood evidence with the player's earlier M01 knowledge when the relevant prior flag exists.

### Shape

```
CURRENT INTERACTION
├─ prior state absent → normal local path
└─ prior state present
   → historical callback
   → altered information / relationship / access / interpretation
```

### Parameters
- source module/state;
- current NPC/location;
- callback condition;
- callback consequence.

### Rule
A callback may react to history but must never invent an event the player did not actually complete.

### Why this is new
M01 established persistence; M02 is the first module that demonstrates **cross-module history as a first-class branch input**.

---

## R34 — ACCESS BOUNDARY / RECONNAISSANCE GATE

**Class:** REUSE

**M02 example:** Palude Mirto boundary.

The player may legally reach and inspect a boundary even when full access beyond it is gated.

### Shape

```
APPROACH RESTRICTED AREA
→ boundary
├─ inspect access requirement
├─ observe local ecology
├─ investigate nearby anomaly
├─ return
└─ enter deeper area only if legal
```

### Parameters
- required rank/access state;
- boundary location;
- legal observations/actions;
- deeper destination;
- optional evidence hooks.

### Rule
Do not teleport the player past a gate and do not disable all interaction merely because deeper access is locked.

### Reuse for
- rank-gated zones;
- tournament backstage;
- restricted facilities;
- dangerous biomes;
- qualification-only venues;
- World-stage access layers.

---

## R35 — CONDITIONAL ALLY CO-ACTION

**Class:** ADAPT

**M02 example:** N can become an active witness/partner in the poaching-network encounter only when the real relationship/context supports it.

### Shape

```
EVENT
├─ ally unavailable/incompatible → solo routes
└─ ally available + compatible state
   → coordinate
      ├─ gather evidence together
      ├─ divide roles
      ├─ intervene
      └─ defer / separate
```

### Inputs
- NPC presence;
- relationship;
- prior encounter state;
- compatible motive;
- current event.

### Rule
An NPC must not materialize solely to unlock a branch.

### Difference from Friend Beat
R35 is not a scheduled social beat. The NPC is participating in a live world event with a causal role.

---

## R36 — MULTI-MODAL CONFLICT RESOLUTION LATTICE

**Class:** REUSE CORE → ADAPT CONSEQUENCES

**M02 example:** poaching-network encounter.

A live conflict can support several legitimate intervention modes without requiring combat.

### Shape

```
CONFLICT DISCOVERED
├─ observe
│  ├─ strong evidence
│  └─ partial evidence
├─ follow / investigate further
├─ report to authority
├─ confront
│  ├─ combat
│  ├─ blockade / physical prevention
│  └─ demand / social pressure
├─ coordinate with ally
└─ withdraw
```

All routes write a persistent conflict state appropriate to what actually occurred.

### Parameters
- conflict ID;
- evidence states;
- authority/report destination;
- legal intervention modes;
- combat encounter if any;
- ally hooks;
- partial/resolved/disrupted/ignored outcomes.

### Rules
- combat is one option, not the default solution;
- non-combat routes must have real state consequences;
- withdrawal remains legal when fiction allows it;
- a victory in combat does not automatically equal full investigation/resolution;
- evidence and disruption are separate concepts.

### Why this is worth promoting
R31 LOCAL PROBLEM RESPONSE covered broad world response. R36 formalizes the richer **branch lattice inside one active confrontation**, which is reusable for later criminal, ecological, public-safety and competitive incidents.

---

# 10. M02_05→M02_07 — WHAT WAS NOT PROMOTED

The following are **not** new archetypes:

- Ranger evidence discussion → R30 INVESTIGATION / EVIDENCE AGGREGATION
- opening a formal Ranger thread → R11 QUEST LIFECYCLE + R30
- ecology observation at Palude Mirto → R03/R07
- anomaly check → R03/R04
- rank information → R16 ROSTER / ELIGIBILITY INFO generalized to access requirements
- N-specific ethics/dialogue → UNIQUE Anchor content
- combat with poacher → R06 COMBAT HANDOFF
- report-ready return to Borgo Salice → R01 LOCATION RETURN + R30
- strong vs partial evidence from a check → R03/R04 outcome adaptation

Therefore M2_05→M2_07 expand the library by **four reusable patterns**, not by 38 new systems.



---

# 11. M02 COMPLETE — FINAL PROMOTIONS

Canonical M02 completion reviewed at `pokemon5e-digital-bookgame@770acec`.

Final M02 runtime surface:

- **189 nodes**
- **409 choices**
- M01 + M02 combined: **391 nodes / 872 choices**
- observed combined ratio: **~2.23 choices per node**

M02_08→M02_14 mostly reuse R01→R36. Two additional reusable families are now proven strongly enough to promote.

## R37 — MULTI-ROUND TOURNAMENT LIFECYCLE

**Class:** REUSE CORE → ADAPT EVENT DATA  
**First proven implementation:** M2_09 Rookie Invitational.

### Shape

```
ANNOUNCEMENT
├─ decline
├─ inspect info
└─ register
   → ROUND 1
      ├─ scout / prepare
      ├─ fight
      │  ├─ loss → final event result
      │  └─ win → next round
      └─ forfeit
   → ROUND 2+
      ├─ fight
      ├─ withdraw if legal
      ├─ loss
      └─ win
   → EVENT RESULT
      ├─ placement / win
      ├─ elimination
      ├─ withdrawal
      └─ forfeit
```

### Parameters

- competition/event ID;
- eligibility/registration;
- round count;
- opponents from authoritative competition state;
- scouting/preparation hooks;
- withdrawal/forfeit policy;
- result callbacks;
- event completion/history.

### Rules

- every match uses the existing combat/competition resolver;
- a win is never scripted by the narrative;
- advancing requires the actual prior result;
- withdrawal/forfeit is distinct from losing a played match;
- later rounds must not become visible before the required prior result;
- event history/result must be idempotent.

### Reuse for

- Regional Cup;
- Upper Regional;
- Continental Cup;
- World Qualifier;
- Last Chance;
- World knockout rounds where a multi-round event shell is useful.

R37 does **not** replace E5 competition state. It is the reusable scene/node lifecycle around E5.

---

## R38 — COMPOSITE OUTCOME CLASSIFIER

**Class:** REUSE CORE → ADAPT AXES  
**First proven implementation:** M2_11 Network Outcome.

A conflict result may depend on several independent pieces of persistent state rather than one binary flag.

### Shape

```
READ PERSISTENT AXES
→ classify canonical outcome
├─ resolved
├─ partial
├─ escalated
└─ ignored
→ expose outcome-specific review/callbacks
→ register outcome completion
```

### Possible input axes

- player intervention;
- evidence gathered;
- authority informed;
- conflict disruption;
- ally contribution;
- delay/inaction;
- crisis escalation;
- world/NPC response.

### Rules

- classification reads facts already produced by play;
- result branches must be mutually coherent;
- no outcome branch may fabricate an action the player never took;
- `partial` must preserve what remains unresolved;
- `resolved` should require the actual required combination, not one convenient flag;
- classification should be deterministic for the same state;
- registration is idempotent.

### Reuse for

- rescue aftermath;
- smuggling investigations;
- environmental crises;
- multi-part public incidents;
- qualification/career aftermath where several axes matter;
- M12 callback synthesis.

R38 is related to R29/R36 but distinct:
- R29 = the world progresses independently;
- R36 = multiple intervention modes inside a live conflict;
- R38 = after those actions, derive one coherent persistent outcome from several state axes.

---

# 12. M02 COMPLETE — PATTERNS NOT PROMOTED

The following final-M02 structures are already covered:

- FRIEND_BEAT_02 dispatch/content → R23 + R26 + R27
- remote friend exchange → variant of R27, not a new system
- optional friend spar → R05 + R06
- crisis response after off-screen escalation → R29 + R31 + R36
- Ranger report during crisis → R30
- Trial information / roster requirements → R16
- Trial registration / postponement → R17
- Promotion Trial battle → R18 + R06
- Trial win/loss/retry → R19
- M2 exit contract / M3 unlock → R20 + R21

Therefore the completed first two modules establish:

**NODE REUSE LIBRARY V1 = R01→R38**

This is now the default structural vocabulary for M03 production.

New Rxx families should be added only after an implemented block proves that R01→R38 cannot express its structural job cleanly.

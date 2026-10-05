# P5E LIBROGAME — M01 REUSE EXTRACTION

**Status:** STRUCTURAL BASELINE  
**Source:** complete M01 implementation on `pokemon5e-digital-bookgame`  
**Companion:** `../NODE_REUSE_CATALOG.md`  
**Purpose:** identify exactly what M01 contributes as reusable production infrastructure for M02→M12.

---

# 0. M01 AS BASE — WHAT THIS MEANS

M01 is the **component base**, not a mandatory plot template.

Later modules should reuse:
- proven node topology;
- generic effects;
- service flows;
- quest lifecycle;
- combat flow;
- ecology flow;
- NPC schedule gating;
- competition flow;
- module-exit logic;
- regression families.

Later modules must **not** automatically reproduce:
- “road → city → job board → ecology problem → anchor → Trial”;
- M01 pacing;
- M01 conflict;
- M01 cast roles;
- M01 emotional beats.

Use M01 as LEGO pieces, not as the same building with different names.

---

# 1. SOURCE SURFACE

M01 currently spreads its authored runtime structure across:

- `first-road.json`
- `m01-release.json`
- `m01-first-road.json`
- `m01-ginestre-crossroads.json`
- `m01-valedarsena-first-arrival.json`
- `m01-farm-first-arrival.json`
- `m01-world-moves.json`
- `m01-blue-enters.json`
- `m01-friend-beat-01.json`
- `m01-five-roads.json`
- `m01-ecology-opportunities.json`

Observed runtime surface:

- **202 nodes**
- **463 choices**
- **17 check choices**
- **26 combat choices**
- **4 ecology selector choices**

This is the first complete structural corpus.

---

# 2. FILE-BY-FILE EXTRACTION

## 2.1 `m01-release.json`

### Existing node
- `free_roam`

### Reuse class
**ADAPT**

### Extracted archetypes
- R01 LOCATION ENTRY / RETURN
- R02 HUB / DESTINATION CHOICE
- R32 WAIT / LET TIME PASS

### Reuse
- multiple destinations;
- legal wait;
- time cost;
- location update.

### M01-only
- Campus release;
- first career freedom;
- initial F→E context.

---

## 2.2 `m01-first-road.json`

### Nodes
- `road_entry`
- `rookie_intro`
- `rookie_directions`
- `sparring_offer`
- `sparring_ready`
- `sparring_handoff`
- `sparring_win`
- `sparring_loss`
- `sparring_withdrawn`
- `clue_success`
- `clue_unclear`

### Reusable core
- R03 SIMPLE SKILL CHECK
- R04 CHECK + INFORMATION
- R05 OPTIONAL SPARRING
- R06 COMBAT HANDOFF
- R07 WILD OBSERVATION REQUEST
- R32 WAIT

### Adapt
- road entry;
- rookie context;
- clue content;
- local fauna list.

### Key lesson
Future route scenes do not need a new travel/spar/check framework.

---

## 2.3 `first-road.json`

### Nodes
- `arrival`
- `observed`
- `trust`
- `warning`
- `combat_handoff`
- `combat_win`
- `combat_loss`
- `houndour_fled`
- `road_continue`
- `houndour_captured`

### Reuse class
**ADAPT + REUSE primitives**

### Reusable core
- R03 check;
- R06 combat handoff;
- R09 wild combat result;
- R01 continuation/return.

### Must remain adapted
The Houndour encounter's:
- motive;
- body language;
- escape route;
- local callback;
- capture meaning.

### Key lesson
A signature ecology encounter should reuse mechanics, not species-swapped prose.

---

## 2.4 `m01-ginestre-crossroads.json`

### Nodes
- `crossroads`
- `tracks_success`
- `tracks_failure`
- `ginestre_pause`
- `rookie_info`
- `houndour_calm_context`
- `houndour_avoided_context`
- `houndour_captured_context`
- `houndour_fled_context`
- `houndour_battle_context`
- `pressure_context`
- `time_morning`
- `time_afternoon`
- `time_evening`
- `time_night`

### Reusable core
- R02 route hub;
- R03/R04 check;
- R22 time-of-day variants;
- R32 wait.

### Adapt
- prior-encounter callbacks;
- local pressure clue;
- route destinations.

### Key lesson
Time-of-day and callback dispatch are generic systems.

---

## 2.5 `m01-valedarsena-first-arrival.json`

This file is M01's richest reusable infrastructure source.

### Nodes
- `approach`
- `center`
- `center_info`
- `job_board`
- `job_farm_taken`
- `job_logistics`
- `logistics_clue`
- `logistics_done`
- `arena_front`
- `arena_watch`
- `trainer_street`
- `city_hub`
- `trial_registered`
- `trial_roster_missing`
- `first_official_offer`
- `first_official_handoff`
- `first_official_win`
- `first_official_loss`
- `roster_preparation`
- `trial_registration_desk`
- `trial_gate_call`
- `trial_combat_handoff`
- `trial_result_win`
- `trial_result_loss`
- `rank_e_access`
- `m02_handoff`
- `trainer_shop`
- `job_board_farm_taken_npc`
- `job_board_notice_new`
- `job_board_notice_known`
- `job_logistics_repost`
- `m1_exit_pending`

### Direct reusable families

#### Services
- R02 HUB NAVIGATION
- R10 TEMPORAL JOB BOARD
- R11 QUEST LIFECYCLE
- R12 SHOP / MARKET
- R13 MEDICAL / CENTER SHELL
- R14 ARENA RECEPTION

#### Competition
- R15 OFFICIAL MATCH
- R16 ROSTER PREPARATION
- R17 REGISTRATION
- R18 TRIAL
- R19 RANK RESULT

#### Progression
- R20 MODULE EXIT
- R21 MODULE HANDOFF

#### Living world
- R23 NPC presence gate
- R29 off-screen job changes

### Adapt
- Valedarsena layout;
- specific jobs;
- shop inventory;
- Arena opponent;
- F→E rank data;
- M02 transition.

### Key lesson
This file should provide most standard inhabited-hub plumbing for later modules.

---

## 2.6 `m01-farm-first-arrival.json`

### Nodes
- `approach`
- `briefing`
- `observe_success`
- `observe_failure`
- `tracks_success`
- `tracks_failure`
- `handling_success`
- `handling_failure`
- `guided_help`
- `job_complete`
- `leave_job`
- `resolved_return`
- `pokemon_support_plan`

### Reusable core
- R03 check;
- R04 evidence;
- R11 quest lifecycle;
- R29 off-screen resolution;
- R31 local problem response.

### Adapt
- farm;
- missing herd;
- handling method;
- local evidence.

### Key lesson
This becomes the model for **field jobs**, not specifically farms.

---

## 2.7 `m01-world-moves.json`

### Nodes
- `ranger_post`
- `farm_report`
- `warehouse_report`
- `general_report`
- `houndour_context`
- `local_response`
- `local_resolution`
- `ignored_context`
- `offscreen_resolution`

### Reuse class
**ADAPT**

### Extracted archetypes
- R29 LIVING WORLD RESOLUTION
- R30 INVESTIGATION / EVIDENCE AGGREGATION
- R31 LOCAL PROBLEM RESPONSE

### Generic pattern
```
reports/evidence
→ interpretation
├─ player acts
│  → partial result
│  → verification
├─ player ignores
│  → world changes
└─ NPC/world resolves
   → callback
```

### Must remain unique
- true cause;
- evidence details;
- local responsible actors;
- resolution.

### Key lesson
This pattern is ideal for M02 crime investigation, M03 industrial safety, M04 port/weather pressure, etc., but the stories must differ.

---

## 2.8 `m01-blue-enters.json`

### Nodes
29 nodes across:
- Arena;
- Center;
- Shop;
- field/logistics overlap;
- talk;
- verbal competition;
- info;
- leave;
- optional spar;
- result.

### Reuse class
**ADAPT / UNIQUE CONTENT**

### Extracted archetypes
- R23 NPC presence gate;
- R24 persistent first meeting;
- R25 multi-context Anchor intro;
- R05 optional sparring;
- R06 combat handoff.

### Reuse
- causal first meeting;
- first-meeting idempotence;
- relationship/result persistence;
- optional interaction;
- ignore path;
- multiple possible first-contact locations.

### Do not reuse blindly
Blue's:
- motive;
- voice;
- competitiveness;
- Squirtle;
- relationship deltas;
- encounter contexts.

### Key lesson
M02 N, M03 Steven, etc. can inherit the **first-meeting architecture**, not Blue's scene.

---

## 2.9 `m01-friend-beat-01.json`

### Nodes
43 total:
- four context dispatch nodes;
- context variants for each possible friend;
- optional sparring handoffs/results;
- four completion nodes.

### Reusable core
- R23 presence gate;
- R26 FRIEND BEAT SELECTOR;
- R27 FRIEND BEAT CONTENT shell;
- R05 spar;
- R06 combat handoff.

### Reuse
The selector itself:
- actual presence;
- location;
- compatible activity;
- recent result;
- relationship;
- deterministic selection.

### Adapt
Every friend-specific scene.

### Critical rule
Do not replicate 20 friend-specific nodes manually forever if the only difference is data.

Where behavior is structurally identical, future implementation can use:
- one generic dispatch shell;
- selected friend ID;
- per-friend authored content/data.

But do not over-genericize dialogue or character behavior.

### Key lesson
This is a prime candidate for reducing later node volume.

---

## 2.10 `m01-five-roads.json`

### Nodes
- `dispatch`
- `luke`
- `mattew`
- `daniel`
- `edward`
- `fab`

### Reuse class
**ADAPT**

### Extracted archetype
- R28 FRIEND DIVERGENCE / UPDATE

### Reuse
- independent careers;
- one visible friend update;
- all friends update state;
- no player reward for NPC work.

### Adapt
Actual paths and career results.

### Key lesson
Future friend updates need not recreate a new persistence mechanism.

---

## 2.11 `m01-ecology-opportunities.json`

### Nodes
33 nodes covering:
- no sighting;
- Wooloo;
- Shinx;
- Hisuian Growlithe;
- urban observation;
- wild handoff;
- peaceful return;
- win/loss/capture.

### Reusable core
- R07 ecology selector;
- R08 wild encounter skeleton;
- R09 wild result;
- R03 checks.

### Highly reusable
- no encounter;
- observation;
- leave;
- tension;
- combat handoff;
- win/loss/capture;
- return to owner scene.

### Must adapt
- animal behavior;
- local habitat;
- species grouping;
- encounter motive.

### Key lesson
Later modules should not write a new combat-outcome trio for every species if the state behavior is identical.

---

# 3. M01 BASE KIT FOR FUTURE MODULES

A later module may pull from this kit.

## World/navigation kit
- location entry;
- hub;
- route fork;
- travel;
- wait;
- time-of-day.

## Service kit
- Center / medical;
- Market;
- Job Board;
- Arena reception;
- generic information desk.

## Quest kit
- offer;
- accept;
- active;
- complete;
- fail;
- expire;
- resolve by NPC/world;
- callback.

## Encounter kit
- ecology request;
- no sighting;
- animal observe;
- check;
- engage;
- combat;
- win/loss/capture.

## Trainer interaction kit
- optional spar;
- first meeting;
- persistent relationship;
- presence/schedule gate.

## Friend kit
- selector;
- activity;
- optional fight;
- result persistence;
- divergence/update.

## Competition kit
- official offer;
- registration;
- roster legality;
- match;
- Trial/gate;
- result;
- rank access.

## Module lifecycle kit
- mandatory-beat exit contract;
- pending state;
- complete flag;
- next-module unlock.

---

# 4. WHAT CAN BE PARAMETERIZED DIRECTLY

These are strong candidates for one structural implementation with module data.

## Service parameters
```
serviceId
locationId
npcId
openingRules
inventory/actions
prices/costs
returnNode
```

## Job parameters
```
questId
title
objective
deadline
expiryResolution
reward
location
worldResolver
```

## Travel parameters
```
from
to
timeCost
arrivalNode
travelConditions
encounterTable
```

## Spar parameters
```
opponentId
team/roster
format
encounterId
resultCallbacks
```

## Ecology parameters
```
zoneId
habitat
method
allowedSpecies
time
resultMap
```

## Trial parameters
```
checkpointId
fromRank
toRank
rosterRequirement
examinerId
opponentRoster
format
retryPolicy
resultNodes
```

## Module exit parameters
```
moduleCompleteFlag
mandatoryBeats
progressionCondition
nextUnlockFlag
handoffNode
```

---

# 5. WHAT SHOULD NOT BE PARAMETERIZED INTO GENERIC TEXT

Do not attempt a single text template for:

- Anchor introductions;
- moral conflict;
- discoveries;
- friend personality;
- major ecological incidents;
- serious injuries;
- major competitions;
- module climax;
- long-term callbacks;
- World Championship story.

Their mechanics can be generic; their authored content cannot.

---

# 6. REUSE OPPORTUNITIES FOUND IN M01 ITSELF

M01 also reveals places where later production can become leaner than M01.

## 6.1 Friend Beat duplication

M01 contains many near-parallel nodes because each friend/context is explicitly authored.

Future module architecture can preserve authored friend content while reducing duplicated control flow.

Potential split:

```
GENERIC FRIEND DISPATCH
→ selected friend
→ authored friend payload
→ shared completion/result primitive
```

## 6.2 Ecology outcome duplication

M01 repeats generic:
- win;
- loss;
- capture;
- peaceful return;

for multiple zones.

Future implementation can use shared result templates when destination is passed as data.

## 6.3 Services

Center, shop, job board and Arena can become reusable service components rather than one-off scene logic.

## 6.4 Competition

Official match and Trial lifecycle should become stable infrastructure. Later modules should mostly supply data and unique event context.

---

# 7. BASE MODULE COMPOSITION

M01's 16 block roles can be abstracted as component roles:

| M01 role | General reusable role |
|---|---|
| M1_00 Release | module/world entry |
| M1_01 Road | travel/exploration |
| M1_02 Houndour | signature encounter |
| M1_03 Fork | route choice |
| M1_04 City | hub |
| M1_05 Job Board | service/jobs |
| M1_06 Farm | field quest |
| M1_07 World Moves | living-world conflict |
| M1_08 Blue | Anchor |
| M1_09 Friend Beat | persistent friend |
| M1_10 Official | competition |
| M1_11 Second Pokémon | roster/opportunity |
| M1_12 Five Roads | NPC career update |
| M1_13 Registration | eligibility |
| M1_14 Trial | gate |
| M1_15 Result | progression/handoff |

This table is a **library map**, not a requirement that later modules contain one instance of every role.

---

# 8. RULE FOR CLAUDE / FUTURE PRODUCTION

Before implementing a later block:

1. identify its engine jobs;
2. look them up in `NODE_REUSE_CATALOG.md`;
3. mark each job REUSE / ADAPT / UNIQUE;
4. copy only proven structure;
5. rename all local IDs;
6. supply local data/state;
7. write new module-specific conflict/content;
8. reuse applicable regression tests;
9. run full suite;
10. document deviations.

Expected production note:

```
STRUCTURAL REUSE
- R10 Job Board: REUSE
- R11 Quest lifecycle: REUSE
- R23 NPC schedule gate: REUSE

LOCAL ADAPTATION
- new Borgo Salice jobs
- Ranger NPC
- M02 expiry consequences

UNIQUE
- illegal capture network clues
```

---

# 9. CURRENT RECOMMENDATION

While M02→M12 are being built without screenplay:

**Do not rewrite M01 prose now.**

Use M01 for:
- structural extraction;
- reusable node design;
- test-template extraction;
- duplication reduction;
- production conventions.

Final screenplay can begin after the structural module chain is stable.

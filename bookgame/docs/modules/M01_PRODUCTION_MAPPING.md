# P5E LIBROGAME — M01 PRODUCTION MAPPING

**Module:** M01 — Le Prime Strade  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md` and `M01_LE_PRIME_STRADE_MODULE_DESIGN.md`  
**Purpose:** production map for converting M01 into validated offline story content  
**Locked budget:** **5,047 stitches / 3,116 player choices**

This file maps the full production surface of M01. It does not replace the design document. It defines where content belongs, what state each block reads/writes, which callbacks must exist, and which runtime capabilities are prerequisites.

---

# 1. MACRO GRAPH

```text
INTRO_FIVE
   ↓
M1_00 RELEASE
   ↓
M1_01 FIRST ROAD
   ↓
M1_02 HOUNDOUR
   ↓
M1_03 FIRST REAL FORK
   ├───────────────┬────────────────┐
   ↓               ↓                ↓
M1_04 CITY      M1_06 FARM      free exploration
   ↓               ↓                ↓
M1_05 JOB BOARD ───┴────────────────┘
        ↓
M1_07 WORLD MOVES
   ├───────────────┬─────────────────┐
   ↓               ↓                 ↓
M1_08 BLUE     M1_09 FRIEND      M1_10 OFFICIAL
   └───────────────┴─────────────────┘
                   ↓
            M1_11 SECOND POKÉMON
                   ↓
             M1_12 FIVE ROADS
                   ↓
         M1_13 TRIAL REGISTRATION
                   ↓
           M1_14 PROMOTION TRIAL
              ↙             ↘
        loss/retry          win
              ↘             ↙
             M1_15 RESULT
                   ↓
              M02 access
```

The graph is reconvergent, not linear. The player may move repeatedly between Ginestre, Valedarsena and the Farm while world state advances.

---

# 2. BUDGET MAP

| Block | Function | Stitches | Choices | Current state |
|---|---|---:|---:|---|
| M1_00_RELEASE | release from guided intro into free-roam | 150 | 90 | IMPLEMENTED |
| M1_01_FIRST_ROAD | road life, travel teaching, optional trainer/fauna signals | 320 | 200 | PARTIAL |
| M1_02_HOUNDOUR_GINESTRE | ecological Houndour encounter and callbacks | 360 | 220 | PARTIAL / CANONICAL ASSET EXISTS |
| M1_03_FIRST_REAL_FORK | first real route choice and local exploration | 220 | 150 | PARTIAL |
| M1_04_VALEDARSENA_FIRST_ARRIVAL | first hub arrival and orientation | 460 | 310 | PARTIAL |
| M1_05_JOB_BOARD | temporal jobs, logistics, Sera Noll | 360 | 260 | PARTIAL |
| M1_06_FARM_HERD_HANDS | farm recovery quest and ecology | 450 | 310 | PARTIAL |
| M1_07_WORLD_MOVES | pressure state machine and off-screen consequences | 450 | 290 | ENGINE DEPENDENCY |
| M1_08_BLUE_ENTERS | Blue causal introduction variants | 380 | 240 | ENGINE DEPENDENCY |
| M1_09_FRIEND_BEAT_01 | one of the other Four selected causally | 390 | 250 | ENGINE DEPENDENCY |
| M1_10_FIRST_OFFICIAL | first sanctioned non-trial match | 270 | 170 | IMPLEMENTED / E5 WIRED |
| M1_11_SECOND_POKEMON | legal routes to roster size 2 | 280 | 180 | IMPLEMENTED / E7 WIRED |
| M1_12_FIVE_ROADS | friends diverge and schedules update | 250 | 150 | ENGINE DEPENDENCY |
| M1_13_TRIAL_REGISTRATION | gate eligibility and preparation | 160 | 90 | IMPLEMENTED / E5 WIRED |
| M1_14_PROMOTION_TRIAL_F_E | official F→E trial | 200 | 110 | IMPLEMENTED / E5 + COMBAT WIRED |
| M1_15_TRIAL_RESULT | win/loss/retry/callback consequences | 347 | 96 | IMPLEMENTED / E5 + PERSISTENCE WIRED |
| **TOTAL** |  | **5,047** | **3,116** | |

Budget means authored production capacity, not that one playthrough sees every stitch or choice.

---

# 3. CURRENT IMPLEMENTATION ANCHORS

Existing files must be expanded or reused rather than duplicated:

- `first-road.json` → M1_01 + M1_02 anchor
- `m01-ginestre-crossroads.json` → M1_03 anchor
- `m01-valedarsena-first-arrival.json` → M1_04 + M1_05 anchor
- `m01-farm-first-arrival.json` → M1_06 anchor

Existing Houndour meaning must not be rewritten merely to fit the production naming convention.

---

# 4. ENGINE DEPENDENCY MAP

The current Node Spec supports narration, choices, checks, combat handoff, `set_flag`, `set_location` and cross-scene transitions. Full M01 requires the following generic engine capabilities before the affected blocks are considered production-complete.

## E1 — Choice / scene conditions

Required for:

- flag prerequisites;
- rank checks;
- roster-size checks;
- trainer-level checks;
- relationship/state variants;
- hiding choices that are not currently legal.

No arbitrary JavaScript or `eval`. Conditions must be data-driven and compiler validated.

## E2 — Time/calendar mutation — IMPLEMENTED

Required for:

- Campus → Ginestre = 20 minutes;
- Ginestre → Valedarsena = 70 minutes;
- Ginestre → Fattoria = 70 minutes;
- arrival-time variants;
- world-day triggers;
- service opening/closing;
- timed jobs.

## E3 — Quest state / journal — IMPLEMENTED

Required for:

- Active / Completed / Failed;
- timed expiry;
- ignored jobs;
- off-screen completion;
- `SQ_FARM_HERD_HANDS`;
- urban/logistics jobs.

## E4 — NPC schedule + relationship state — IMPLEMENTED

Required for:

- Blue presence variants;
- FRIEND_BEAT selector;
- friends moving independently;
- callbacks based on prior meeting/result.

## E5 — Official competition / gate state — IMPLEMENTED

Required for:

- first sanctioned match;
- official roster legality;
- Promotion Trial registration;
- Rank F → E;
- retry state;
- result history.

Combat resolution remains under Pokémon 5e; this dependency is competition state, not a second battle engine.

## E6 — World trigger / off-screen event progression — IMPLEMENTED

Required for:

- `A1_WORLD_MOVES`;
- ignored fauna pressure;
- jobs completed by NPCs;
- Blue progressing without the player;
- friends advancing while the player delays;
- no frozen quests/world.

## E7 — Authored ecological encounter selection — IMPLEMENTED

Required for:

- multiple legal second-Pokémon opportunities;
- zone/biome/time filtering;
- ordinary wild capture routes;
- no Legendary/Mythical/Paradox leakage.

---

# 5. BLOCK CONTRACTS

## M1_00_RELEASE

**Target:** 150 stitches / 90 choices  
**Entry:** `intro_complete=true`, Rank F, starter present  
**Reads:** intro completion, protagonist identity, starting location  
**Writes:** `free_roam=true`  
**Must provide:**

- clear transition from guided opening to player-directed play;
- multiple visible destinations/interactions;
- diegetic knowledge that Promotion Trials exist;
- no mandatory quest assignment.

**Primary exits:** M1_01, local interaction, later return to Campus edge if allowed by world map.

**Acceptance test:** player can leave intro without accepting a quest and still progress.

**Implementation lock:**

- the post-onboarding state enters `m01-release#free_roam`;
- `intro_complete=true` and `free_roam=true` are already durable at the release point;
- no quest is auto-started;
- Ginestre, Valedarsena and Fattoria are peer directions, not a forced main path;
- waiting in place consumes normal world time, refreshes NPC schedules and permits world events to resolve;
- save/reload preserves both the untouched release point and any chosen branch exactly.

---

## M1_01_FIRST_ROAD

**Target:** 320 / 200  
**Zone:** AST-GINESTRE  
**Reads:** protagonist, time, current location  
**Writes:** first-road observations and travel history only where needed  
**Must provide:**

- road as living place;
- optional rookie encounter;
- environmental clues;
- optional sparring hook;
- wildlife that does not auto-aggro;
- first meaningful travel/time presentation.

**Canonical reuse:** `A1_FIRST_ROAD`, `SQ_GINESTRE_FIRST_SPARRING`.

**Exits:** Houndour, first fork, optional local branches.

---

## M1_02_HOUNDOUR_GINESTRE

**Target:** 360 / 220  
**Canonical asset:** `first-road.json`, encounter `HOUNDOUR_GINESTRE_001`  
**Reads:** Houndour availability, prior local state  
**Writes:**

- `houndour_ginestre_disposition`
- `houndour_ginestre_escalation`
- capture state if combat resolver returns captured

**Required routes:**

- observe;
- calm;
- warn/back away;
- battle;
- capture when legal;
- animal flees;
- leave it alone.

**Callbacks:** Ranger Elio, fauna pressure interpretation, second-Pokémon preparation.

**No-go:** moral punishment merely for choosing combat; predetermined capture; narrative damage resolution.

---

## M1_03_FIRST_REAL_FORK

**Target:** 220 / 150  
**Reads:** Houndour outcome, world pressure knowledge, time  
**Writes:** first-fork context if useful  
**Must expose at least:**

- Valedarsena;
- Fattoria del Vento;
- local interaction/exploration;
- ability to remain in Ginestre while time passes.

**Shape:** diamond with loops, not one-way menu.

---

## M1_04_VALEDARSENA_FIRST_ARRIVAL

**Target:** 460 / 310  
**Zone:** VAL-CITY  
**Writes:**

- `first_settlement_reached=true`
- `valedarsena_discovered=true`

**Must introduce gradually:**

- Pokémon Center;
- Via Allenatori;
- Job Board;
- Arena Civica;
- trainer shop/economy when useful;
- exits back to surrounding zones.

**Must not:** deliver ten tutorials in sequence or force Job Board interaction.

**Callback trigger:** may activate M1_07 through `first_settlement_reached`.

---

## M1_05_JOB_BOARD

**Target:** 360 / 260  
**Anchor NPC:** Sera Noll  
**Reads:** time, jobs already taken/completed/expired, local pressure  
**Writes:** quest states  
**Minimum authored jobs:**

- `SQ_FARM_HERD_HANDS`;
- one urban/logistics job;
- notices that communicate changing local conditions.

**Temporal outcomes:**

- accepted;
- ignored;
- taken by NPC;
- expired;
- reposted/changed;
- completed off-screen where authored.

---

## M1_06_FARM_HERD_HANDS

**Target:** 450 / 310  
**Zone:** AST-FARM  
**Quest:** `SQ_FARM_HERD_HANDS`  
**Reads:** quest state, friend availability, fauna pressure  
**Writes:** quest result, player involvement, relevant local reputation/relationship later

**Required approaches:**

- observe;
- Investigation;
- Animal Handling;
- cooperate with own Pokémon;
- follow worker instructions;
- seek help;
- leave;
- battle only if situation mechanically becomes dangerous.

**Optional integration:** FRIEND_BEAT_01 when selector makes it causal.

---

## M1_07_WORLD_MOVES

**Target:** 450 / 290  
**Event:** `A1_WORLD_MOVES`  
**Trigger:** `world_day >= 3 OR first_settlement_reached`

**State machine:**

- pressure_unnoticed
- pressure_noticed
- pressure_investigated
- pressure_partially_resolved
- pressure_resolved_local
- pressure_ignored
- pressure_resolved_offscreen

**Information sources:**

- Ranger Elio Mar;
- Sera/Job Board;
- Farm workers;
- warehouse/logistics workers;
- direct observation;
- wildlife behavior.

**Core rule:** no single villain or magical one-step solution.

**Ignored path:** authored NPC/off-screen response continues without player rewards.

---

## M1_08_BLUE_ENTERS

**Target:** 380 / 240  
**Reads:** Blue schedule, player location, previous overlap, local activity  
**Writes:**

- `blue_met`
- `blue_relationship_state`
- `blue_m1_result_context`

**Legal introduction contexts:**

- Arena;
- Job/field overlap;
- Trainer Shop / Center.

**Presence bands:**

- minimum: brief recognition;
- medium: conversation/technical comparison;
- high: shared/competitive activity and possible legal match.

**Always allow:** talk, ignore, compete verbally, ask information, leave.  
**Never require:** beating Blue.

---

## M1_09_FRIEND_BEAT_01

**Target:** 390 / 250  
**Mandatory event, selected from the other Four.**

**Selector inputs:**

1. schedule;
2. location;
3. relationship;
4. recent results;
5. content compatibility.

**Possible forms:**

- shared job;
- exploration;
- fauna help;
- sparring;
- city encounter;
- official match if naturally produced.

**Writes:**

- `friend_beat_01_complete=true`
- `friend_beat_01_friend_id`
- `friend_beat_01_type`
- real result if battle occurred

**Battle rule:** real roster, early-game state, no buff, no scripted winner.

---

## M1_10_FIRST_OFFICIAL

**Target:** 270 / 170  
**Event:** `A1_FIRST_OFFICIAL`  
**Trigger:** Trainer level >=2 OR authored official-match opportunity

**Format:**

- sanctioned Singles;
- one Pokémon;
- STANDARD opponent;
- generic trainer or friend only when causal.

**Writes:** `first_official_resolved` + actual result/history.

**Loss:** does not block M1.  
**Must teach:** sanctioned match != Promotion Trial.

---

## M1_11_SECOND_POKEMON

**Target:** 280 / 180  
**Purpose:** give multiple legal ways to satisfy official roster size 2.

**Sources:**

- Houndour;
- AST-GINESTRE pool;
- AST-FARM pool;
- legal urban/rural opportunities;
- authorized authored encounters.

**Rules:**

- no gift invented to solve gate;
- no auto-capture;
- no custom loan;
- capture follows Pokémon 5e;
- player may remain with one Pokémon indefinitely and therefore remain ineligible for Trial.

**Callback:** identity/result of second capture persists.

---

## M1_12_FIVE_ROADS

**Target:** 250 / 150  
**Event:** `A1_FIVE_ROADS`  
**Trigger:** Trainer level >=3 OR Rank E OR world_day >=7

**Writes:**

- `friends_split=true`
- individual schedule updates

**Must show at least one friend materially diverging:**

- travels;
- accepts remote work;
- prepares own Trial;
- changes path;
- obtains own result.

Others update off-screen honestly.

---

## M1_13_TRIAL_REGISTRATION

**Target:** 160 / 90  
**Venue:** Arena Civica  
**Eligibility:**

- Rank F;
- Trial available;
- legal roster size 2.

**Choices:**

- register;
- postpone;
- heal/prepare;
- continue free-roam.

**No narrative substitute** for mechanical eligibility.

---

## M1_14_PROMOTION_TRIAL_F_E

**Target:** 200 / 110  
**Event:** `A1_FIRST_GATE`  
**Checkpoint:** `RANK_F_TO_E`  
**Expected Trainer level:** 2–3  
**Battle:** Singles  
**Official roster:** 2  
**Opponents:** 1  
**Difficulty:** HARD for band, fixed/authored, no invisible scaling  
**Retry:** yes

**Opponent:** persistent gate staff with fixed validated Pokémon 5e roster.

Blue/friends are not automatically used as gate opponent.

---

## M1_15_TRIAL_RESULT

**Target:** 347 / 96

### Loss route

- Rank remains F;
- attempt/result recorded;
- world and NPC schedules continue;
- Trial remains retryable;
- no narrative reset;
- HP/PP/conditions come from real battle result.

### Win route

- `current_rank=E`;
- Rank E access opens;
- M02 becomes reachable;
- unresolved jobs/world pressure/relationships remain persistent.

### Shared callbacks to preserve

- Houndour treatment;
- Valedarsena reputation;
- Ranger Elio relation;
- Blue relation/result context;
- First Official result;
- FRIEND_BEAT_01;
- friend schedule divergence;
- second Pokémon;
- failed/expired jobs;
- world-pressure state.

---

# 6. STATE OWNERSHIP MAP

| State | Primary producer | Main consumers |
|---|---|---|
| intro_complete | Intro | M1_00 |
| free_roam | M1_00 | all M1 exploration |
| houndour_ginestre_disposition | M1_02 | M1_07, Ranger callback |
| houndour_ginestre_escalation | M1_02 | M1_07 |
| first_settlement_reached | M1_04 | M1_07 trigger |
| valedarsena_discovered | M1_04 | city/trial/navigation |
| sq_farm_herd_hands_state | M1_05/M1_06 | M1_07, later callbacks |
| m1_world_pressure_state | M1_07 | M1_08+, M02 |
| m1_world_pressure_known | M1_01/03/04/05/06/07 | investigation/dialogue variants |
| m1_world_pressure_player_involved | M1_06/07 | reputation/callbacks |
| blue_met | M1_08 | all later Blue scenes |
| blue_relationship_state | M1_08+ | Blue variants |
| blue_m1_result_context | M1_08 | future Blue callbacks |
| friend_beat_01_complete | M1_09 | M1 exit / M02 |
| friend_beat_01_friend_id | M1_09 | later friend callbacks |
| friend_beat_01_type | M1_09 | later friend callbacks |
| first_official_resolved | M1_10 | progression/history |
| friends_split | M1_12 | M1 exit / future schedules |
| rank_trial_F_E_available | Arena/competition state | M1_13 |
| rank_trial_F_E_attempts | M1_14 | M1_15/retry |
| rank_trial_F_E_best_result | M1_14/15 | history |
| current_rank | career state / M1_15 | M02 access |

Do not duplicate HP, PP, inventory, money, Trainer level, Pokémon level, roster state, injuries or schedules when those become canonical structured state.

---

# 7. LOCATION / SCENE OWNERSHIP

## Campus edge
Owned mainly by M1_00.

## AST-GINESTRE
Owned by M1_01, M1_02, M1_03 and portions of M1_11.

## AST-FARM
Owned by M1_06, M1_07 and portions of M1_09/M1_11.

## VAL-CITY
Owned by M1_04, M1_05, M1_08, M1_10, M1_13, M1_14, M1_15.

## VAL-WAREHOUSES
Owned by M1_05, M1_07 and optional M1_08/M1_09 overlap.

A scene may serve multiple beats, but state ownership must stay unambiguous.

---

# 8. CALLBACK MATRIX

| Earlier action | M1 callback | Later callback |
|---|---|---|
| Houndour caught | roster size may reach 2 | Ranger/second-capture history |
| Houndour calmed | Elio can recognize handling | reputation/dialogue |
| Houndour fled | animal no longer frozen at original node | world-pressure variant |
| Farm completed | pressure investigation starts with stronger evidence | reputation/M02 |
| Farm ignored/abandoned | NPC resolution possible | no unearned reward |
| Logistics clue found | pressure known earlier | Elio/warehouse dialogue |
| Blue ignored | Blue progresses anyway | later meeting acknowledges it |
| Blue challenged | real result recorded | relationship/result callback |
| Friend Beat with X | X gets persistent context | future X dialogue/schedule |
| First Official loss | career continues | later competitive callback |
| Trial loss | stay F, world continues | retry state |
| Trial win | Rank E | M02 unlock |

---

# 9. PRODUCTION ORDER

Production is not simply “write M1_00 then M1_15”. Use this order:

## Phase A — Runtime gates

Implement E1 conditions, E2 time, E3 quest state first.

## Phase B — Complete open-area foundation

Expand M1_00 through M1_06 using the existing scenes and new side branches.

## Phase C — Living world

Implement E4 schedules/relationships and E6 off-screen triggers, then complete M1_07, M1_08, M1_09 and M1_12.

## Phase D — Competition / roster progression

Implement E5 and E7, then complete M1_10, M1_11, M1_13, M1_14 and M1_15.

## Phase E — Regression

Required full-run families:

- Houndour caught;
- Houndour avoided;
- Farm completed;
- Farm ignored;
- Blue fought;
- Blue not fought;
- different FRIEND_BEAT friend;
- first official win/loss;
- no second Pokémon for extended period;
- Trial loss then retry;
- Trial win;
- delayed multi-day progression.

---

# 10. M01 EXIT CONTRACT

M01 is formally promotion-complete when:

- `current_rank=E`;
- Blue has been introduced;
- `friend_beat_01_complete=true`;
- `friends_split=true`;
- M02 access condition is valid.

M01 remains playable while Rank F if the player delays, lacks a second Pokémon or loses the Trial.

No module reset occurs.

---

# 11. PRODUCTION RULE

Do not chase the 5,047 / 3,116 target by padding.

Every stitch must do at least one of:

- establish place;
- express character;
- expose world state;
- provide information;
- react to prior state;
- resolve a consequence;
- support a mechanically meaningful choice;
- create a later callback.

Every choice must change at least one of:

- route;
- information;
- time;
- risk;
- relationship;
- quest/world state;
- combat/encounter state;
- access to later authored content.

False choices that immediately collapse without a meaningful state or experiential difference do not count as production-quality branching.

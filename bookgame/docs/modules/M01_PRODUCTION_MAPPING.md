# P5E LIBROGAME — M01 PRODUCTION MAPPING

**Module:** M01 — Le Prime Strade  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md` and `M01_LE_PRIME_STRADE_MODULE_DESIGN.md`  
**Purpose:** production map for converting M01 into validated offline story content  
**Locked budget:** **5,047 stitches / 3,116 player choices**

**Module implementation status:** **COMPLETE** — all M1_00→M1_15 block contracts are closed, the M01 exit contract is enforced, and the full Bookgame test workflow is green on the canonical branch.

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
| M1_00_RELEASE | release from guided intro into free-roam | 150 | 90 | COMPLETE |
| M1_01_FIRST_ROAD | road life, travel teaching, optional trainer/fauna signals | 320 | 200 | COMPLETE |
| M1_02_HOUNDOUR_GINESTRE | ecological Houndour encounter and callbacks | 360 | 220 | COMPLETE |
| M1_03_FIRST_REAL_FORK | first real route choice and local exploration | 220 | 150 | COMPLETE |
| M1_04_VALEDARSENA_FIRST_ARRIVAL | first hub arrival and orientation | 460 | 310 | COMPLETE |
| M1_05_JOB_BOARD | temporal jobs, logistics, Sera Noll | 360 | 260 | COMPLETE |
| M1_06_FARM_HERD_HANDS | farm recovery quest and ecology | 450 | 310 | COMPLETE |
| M1_07_WORLD_MOVES | pressure state machine and off-screen consequences | 450 | 290 | COMPLETE |
| M1_08_BLUE_ENTERS | Blue causal introduction variants | 380 | 240 | COMPLETE |
| M1_09_FRIEND_BEAT_01 | one of the other Four selected causally | 390 | 250 | COMPLETE |
| M1_10_FIRST_OFFICIAL | first sanctioned non-trial match | 270 | 170 | COMPLETE |
| M1_11_SECOND_POKEMON | legal routes to roster size 2 | 280 | 180 | COMPLETE |
| M1_12_FIVE_ROADS | friends diverge and schedules update | 250 | 150 | COMPLETE |
| M1_13_TRIAL_REGISTRATION | gate eligibility and preparation | 160 | 90 | COMPLETE |
| M1_14_PROMOTION_TRIAL_F_E | official F→E trial | 200 | 110 | COMPLETE |
| M1_15_TRIAL_RESULT | win/loss/retry/callback consequences | 347 | 96 | COMPLETE |
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

**Implementation lock:**

- `m01-release#free_roam -> m01-first-road#road_entry` consumes the canonical 20-minute Campus → Ginestre travel;
- `A1_FIRST_ROAD` resolves once on entry to AST-GINESTRE and records `m1_first_road_seen=true`;
- the road can be crossed immediately without doing optional content;
- the rookie conversation exposes `SQ_GINESTRE_FIRST_SPARRING` only by explicit player choice;
- accepting the sparring uses the existing Pokémon 5e combat handoff and registered-opponent protection;
- environmental inspection can reveal the existing M1 world-pressure clue but never blocks travel;
- wildlife observation reuses E7 ecology and never auto-starts combat;
- Houndour can be reached normally or bypassed toward the first fork, so later content cannot assume the encounter happened.

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

**Implementation lock:**

- `HOUNDOUR_GINESTRE_001` remains a one-off ecological encounter whose combat authority stays entirely in the Pokémon 5e resolver;
- observation and Animal Handling preserve the existing DC 12 behavior;
- calm, defensive/back-away, leave-alone, battle, flee and capture routes all produce durable authored callback state;
- `houndour_ginestre_available=false` closes this instance after a terminal authored outcome, so returning to Ginestre cannot respawn the same encounter;
- `houndour_ginestre_disposition` records the factual outcome for later Ranger/fauna callbacks without attaching automatic moral judgment;
- `houndour_ginestre_escalation=avoided` is preserved for the de-escalation callback;
- capture is never authored in advance: the Pokémon enters the roster and `secondPokemonAcquisition` only after the combat resolver returns `captured`; the scene then records the callback flags;
- save/reload preserves both the captured Pokémon state and the resolved Houndour callback state exactly.

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

**Implementation lock:**

- the fork never assumes the Houndour encounter occurred; bypass routes remain canonically valid;
- Valedarsena and Fattoria are peer 70-minute exits and all alternate information routes write the same destination/location history as the direct choices;
- Ginestre can be explored indefinitely through loops that consume real world time rather than freezing the simulation;
- remaining in place can advance day boundaries and fire existing off-screen world events;
- Houndour callbacks appear only for factual outcomes already stored in M1_02 (calm, avoided escalation, captured, fled, battle-position change);
- captured Houndour is treated as roster context, never as a forced next objective;
- known world-pressure information replaces the redundant discovery check with a contextual follow-up, while unknown pressure can still be investigated via Perception;
- failed investigation never traps progress: both destination roads and return-to-fork remain available;
- local observation changes with the current world daypart and consumes time, proving the fork reads the live clock;
- wildlife observation remains optional and reuses E7 ecology;
- no branch is tagged or treated as the correct route.

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

**Implementation lock:**

- every authored route that reaches `m01-valedarsena-first-arrival#approach` writes `first_settlement_reached=true`, `valedarsena_discovered=true` and `world.locationId=valedarsena_city` on arrival;
- first arrival therefore activates the existing `A1_WORLD_MOVES` trigger immediately, including routes from Release, Ginestre and Fattoria;
- the arrival node presents Centro Pokémon, Job Board, Arena Civica, Via Allenatori and the option to leave without forcing an ordered tutorial chain;
- the Job Board can be inspected and ignored without starting any quest;
- `city_hub` is a reusable free-roam hub with explicit exits back to Ginestre and toward Fattoria del Vento;
- internal service transitions keep `world.locationId` synchronized with the actual district/building instead of leaving stale location state;
- Via Allenatori contains a real offline shop using Pokémon 5e 2024 upstream item IDs and prices: Poké Ball ₽250, Potion ₽200, Antidote ₽200;
- trainer money is persisted as `player.money`; New Game starts at ₽0 because the upstream trainer money model has no implicit campaign grant;
- `purchase_item` is atomic: insufficient funds cannot buy on credit, successful purchase subtracts the exact cost and adds the canonical item ID to the same persistent inventory consumed by combat/capture;
- Via Allenatori stock is finite and authored; sold-out purchase choices disappear rather than allowing impossible transactions;
- shop stock is part of persistent career state and refreshes on the locked three-in-game-day cycle (day 1–3, then day 4–6, etc.);
- money, inventory and remaining shop stock survive save/reload exactly;
- M1_04 does not invent rewards or starting cash: jobs/rewards may feed the same ledger in later blocks.

**Item authority:** Pokémon 5e 2024 SRD / `Auroratide/poke5e` (project `rules/sources.yaml` exact-item lookup policy).

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

**Implementation lock:**

- simply reading/ignoring the board creates durable `available` quest offers instead of freezing unseen jobs outside world time;
- `SQ_FARM_HERD_HANDS` offer expires after 360 in-game minutes and resolves as `taken_by_npc` if the player does not accept it;
- accepting `SQ_FARM_HERD_HANDS` creates an active 480-minute intervention window; if the player delays beyond it, farm workers finish the situation off-screen with no player credit;
- `M1_VALE_LOGISTICS_01` offer expires after 180 minutes; an accepted delivery gets a 240-minute active window and can be postponed rather than being forced immediately;
- an ignored/expired first logistics posting triggers `A1_JOB_BOARD_LOGISTICS_REPOST`, which authors a changed shorter-route job as `M1_VALE_LOGISTICS_02` instead of resurrecting the old quest;
- terminal jobs are idempotent on future board refreshes: returning to the Job Board never reopens or rewrites a completed/failed/expired quest;
- Sera Noll is visible as the board coordinator and the board itself can reveal the existing M1 fauna/world-pressure pattern without inventing a single culprit;
- warehouse work keeps `world.locationId` synchronized with `valedarsena_warehouses`;
- offer, active, expiry, NPC resolution, repost and save/reload paths are covered by dedicated regression tests.

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

**Implementation lock:**

- arriving directly at the farm can start `SQ_FARM_HERD_HANDS` with a real local deadline; an already-active Job Board deadline remains authoritative and is not overwritten;
- observing the farm before volunteering now starts the same structured quest correctly, closing the prior runtime hole where completion could occur without an active quest;
- required approaches are authored: observation, Investigation, Animal Handling, cooperation with the player's own Pokémon, direct worker guidance, seeking help after a failed read, and leaving/abandoning;
- own-Pokémon cooperation is field positioning under worker safety instructions, not an invented move or automatic combat action;
- failed Investigation/Animal Handling never traps progress; the player can change method, seek worker guidance or leave;
- M1_06 contains no authored forced battle: combat is reserved for a future state where a real mechanically dangerous encounter exists;
- successful routes persist factual callbacks through `m1_world_pressure_known`, `m1_world_pressure_player_involved`, `m1_farm_helped` and `m1_farm_evidence`, while the structured quest resolution records how the herd was recovered;
- abandonment records `SQ_FARM_HERD_HANDS=failed/abandoned` and `m1_farm_abandoned=true` without granting player credit;
- all farm/city/Ginestre transitions keep `world.locationId` synchronized with the actual destination;
- ecology observation remains optional and uses the existing E7 AST-FARM pool;
- the complete, failure-recovery, own-Pokémon, guidance, abandonment and navigation paths are covered by dedicated regression tests.

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

**Implementation lock:**

- `A1_WORLD_MOVES` initializes the pressure state only when no pressure state already exists, so later terminal states can never be overwritten by a late world trigger;
- the canonical state machine is fully authored: `pressure_unnoticed → pressure_noticed → pressure_investigated → pressure_partially_resolved → pressure_resolved_local`, with the alternate unattended route `pressure_ignored → pressure_resolved_offscreen`;
- evidence discovered after activation advances `pressure_unnoticed` to `pressure_noticed` through the central world-event layer instead of individual scenes owning state transitions;
- Sera/Job Board, Farm evidence, logistics/warehouse evidence and Houndour/wildlife behavior all feed the same pressure model without creating parallel quest flags;
- Ranger Elio Mar is a persistent NPC introduced through the Valedarsena ranger post and can connect independent reports into `pressure_investigated`;
- local resolution requires multiple authored actions: first a field-response step that produces `pressure_partially_resolved`, then a later verification step that closes only the local case as `pressure_resolved_local`;
- successful Farm intervention itself counts as real partial mitigation, never as a magical total solution;
- if the player leaves the pressure unattended through day 5, the state becomes `pressure_ignored`; by day 7 ranger/workforce intervention can close the local problem as `pressure_resolved_offscreen`;
- off-screen resolution gives no player involvement, reward or reputation credit;
- resolved-local states are terminal with respect to ignored/off-screen events and are never downgraded;
- Houndour callbacks are factual ecology observations, explicitly not moral scoring;
- the complete state machine, late evidence, Farm partial mitigation, Ranger investigation, local resolution, ignored route, off-screen route, terminal-state protection and save/reload persistence are covered by dedicated regression tests.

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

**Implementation lock:**

- Blue is already a persistent E4 NPC at New Game with rookie-only state; M1 does not pre-load future achievements, mature personality, Blastoise/Mega Blastoise or any later-world roster;
- after `A1_WORLD_MOVES` resolves, E6 starts Blue's own circuit progression independently of the player and advances his authored schedule through Arena Civica, Centro Pokémon, field/logistics work and Trainer Shop as world days advance;
- Blue's first-meeting hooks appear only when his live E4 schedule says he is present at the same legal location as the player; there is no teleporting rival and no mandatory cutscene;
- the canonical legal introduction contexts are all wired: Arena, Center, Trainer Shop and warehouse/logistics field overlap;
- every minimum introduction exposes talk, ignore, verbal competition, information request and leave; ignoring or leaving still records a valid brief first recognition and never blocks M1 progression;
- first contact writes durable `blue_met`, `blue_relationship_state`, `blue_m1_result_context` and the corresponding persistent Blue NPC state, while relationship adjustments remain contextual rather than forcing friendship or hostility;
- the higher-presence Arena route may offer an optional rookie spar with Squirtle Lv5; the battle is delegated entirely to the Pokémon 5e resolver, has real win/loss outcomes, is not an official Circuit match and has no scripted winner;
- neither meeting Blue nor later progression requires defeating him; a loss, win, technical conversation, competitive exchange, brief recognition or ignored encounter are all legal persistent outcomes;
- Blue is never authored as the cause of the M1 ecological pressure and never replaces Ranger/worker evidence or investigation;
- once the first meeting is recorded, first-introduction hooks disappear on later overlap instead of replaying the same scene;
- Blue continues to move off-screen even if the player does not meet him immediately, proving that his career is not frozen around player presence;
- schedule, meeting state, relationship/result context and optional spar outcome survive save/reload exactly;
- dedicated regression coverage validates all four legal overlap contexts, all required interaction choices, off-screen schedule progression, optional real combat, non-victory progression, first-meeting idempotence and persistence.

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

**Implementation lock:**

- New Game now initializes exactly the other four members of the Five as persistent rookie NPCs for every possible protagonist; the selected protagonist is never duplicated inside the NPC table, and Luke is correctly present when another friend is the player;
- each friend NPC carries only legal rookie state in M1: Trainer Lv1, Rank F, rookie team stage, canonical Lv5 Ace identity and a small recent-result field used by the selector;
- E6 authors independent M1 schedules for the other Four and rotates those schedules across Ginestre, Fattoria del Vento, Valedarsena and Arena contexts as world days advance; the player does not summon or teleport a friend;
- friend schedules stop yielding to the M1_09 rotation after `friends_split=true`, so later `FIVE_ROADS` state is never overwritten by an older world event;
- the generic `friend_beat_select` effect is compiler-validated and offline; it excludes the player and selects only NPCs who are genuinely present at the requested location;
- deterministic selector priority is: legal schedule/location gate → content/activity compatibility → compatible recent result → current relationship score → canonical Five order as final tie-break;
- four authored M1 forms are live: Ginestre exploration, Farm/fauna help, Valedarsena city encounter and Arena sparring;
- the selected friend ID and beat type are written before dispatch, then completion writes `friend_beat_01_complete=true`, `friend_beat_01_friend_id`, `friend_beat_01_type` and a factual result context;
- non-battle routes include shared activity, information/result comparison and brief overlap; no route turns the friend into a permanent party member;
- Arena sparring is optional 1v1 and uses the selected friend's canonical rookie Ace at Lv5; the player's current roster is passed to the Pokémon 5e resolver, no buff is added and no winner is scripted;
- win, loss and declining the spar are all valid persistent outcomes; a battle is never required merely because FRIEND_BEAT_01 is mandatory as a story beat;
- completed FRIEND_BEAT_01 removes all first-beat hooks and cannot replay as a second “first” encounter;
- selection, relationship changes, schedule state, beat type and result survive save/reload exactly;
- regression coverage validates all five possible protagonists, selector priority inputs, independent schedule progression, city/farm/Ginestre/Arena hooks, real sparring, non-battle completion, idempotence and persistence.

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

**Implementation lock:**

- the canonical first sanctioned match remains `A1_FIRST_OFFICIAL` and is an E5 `official_match`, never a `promotion_trial`;
- the Arena first-official hook is legal when either Trainer level is at least 2 **or** an authored `official_match_opportunity` exists, while Rank F and unresolved-first-match remain hard requirements;
- E6 authors `A1_FIRST_OFFICIAL_WINDOW` after Valedarsena has been discovered and a rookie match slot becomes causally available through level progression, FRIEND_BEAT progress or world-day progression; the opportunity is data-authored, not randomly invented;
- deferring the offer leaves the opportunity and competition state untouched and writes no result;
- the match is sanctioned Singles with official roster size 1 and STANDARD difficulty; the combat handoff slices the real player roster to exactly one registered Pokémon even if more are owned;
- the authored generic opponent is stable `VALE_ROOKIE_001` with a registered Shinx, and the opponent trainer ID is written into E5 match history;
- official opponents are registered Trainer Pokémon and therefore cannot enter wild-capture outcomes;
- win and loss are both real resolver outcomes; neither is scripted and neither changes Rank F or completes/creates the Promotion Trial;
- resolving either result writes `competition.firstOfficialResolved`, `competition.firstOfficialResult`, the durable E5 history record, plus explicit callbacks `first_official_resolved`, `first_official_result` and `first_official_match_id`;
- resolving the match consumes the authored match opportunity so the first official cannot replay;
- the result screen explicitly teaches that an official sanctioned match belongs to career history but is not the Promotion Trial gate;
- HP/PP/status consequences still return from the Pokémon 5e combat resolver through the normal roster persistence path;
- full save/reload preserves result callbacks and official history exactly;
- regression coverage validates both legal triggers, defer behavior, one-Pokémon registration, stable opponent identity, win/loss persistence, Rank-F non-promotion, non-replay and save/reload.

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

**Implementation lock:**

- M1 exposes multiple legal sources instead of manufacturing a gate solution: the scripted Houndour encounter, ordinary `AST-GINESTRE` fauna, ordinary `AST-FARM` fauna and an authored `VAL-CITY` urban ecology route;
- the Arena roster-preparation desk explicitly offers Ginestre, Farm, Valedarsena or continuing with one Pokémon; it never grants, lends, substitutes or auto-registers a second Pokémon;
- all ecology choices are compiled from the authoritative E7 zone/distribution/fauna data and remain time-, habitat- and method-filtered;
- the Valedarsena urban subset is `pidgey / burmy / tandemaus / purrloin`, all canonical ordinary `VAL-CITY` species; observing one does not imply combat or capture;
- the E7 mechanical-data gate is enforced per species: Pidgey, Burmy and Purrloin remain observation-only in M1 because they are not yet executable in the local combat slice;
- Tandemaus is ported directly from the locked Pokémon 5e 2024 source into the offline vertical slice with its canonical Lv1 stat block; `Run Away` is supported and `Pound` is executable, making it a real urban battle/capture opportunity;
- wild combat handoff never mutates the roster merely because a fight starts, and a `win` outcome never counts as capture;
- a `captured` handoff is rejected unless a real resolved Pokémon 5e opponent state exists; registered Trainer Pokémon remain uncapturable;
- a valid capture persists the exact species, level, HP, status, ability, move/PP state and capture provenance into the player roster;
- the first capture performed while roster size is exactly one creates durable `player.secondPokemonAcquisition` with species, name, level, day, location and encounter ID;
- later captures may grow the roster but never overwrite the identity/provenance of the actual second Pokémon;
- roster size 2 only makes Trial registration mechanically eligible; it does not auto-register, auto-promote or complete a Trial;
- remaining with one Pokémon is indefinitely legal: Rank stays F and the Trial registration action remains unavailable;
- second-Pokémon identity and all captured state survive save/reload exactly;
- regression coverage validates all four source families, canonical VAL-CITY membership, time filtering, mechanical data gating, Tandemaus executable combat, no auto-capture, resolver-state requirement, second-capture provenance stability, Trial eligibility and save/reload.

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

**Implementation lock:**

- `A1_FIVE_ROADS` is a one-shot E6 world event and fires on the canonical OR trigger: Trainer level 3+, current Circuit Rank E, or world day 7+;
- the event always sets `friends_split=true` and replaces the pre-split day rotation with persistent per-friend schedules for exactly the other Four; the protagonist is never duplicated as an NPC;
- identity-specific paths remain stable across protagonist choices: Luke takes a longer exploration route, Mattew shifts to Promotion Trial preparation, Daniel accepts a logistics contract, Edward commits to field training, and Fab joins a ranger field route;
- at least one concrete divergence is exposed diegetically through `m01-five-roads` from the Valedarsena hub, while every other friend still receives an off-screen schedule/result update;
- NPC progress never grants the player money, relationship credit, rank, quest completion or other unearned rewards;
- the event is idempotent: once resolved it never rewrites later NPC state, and the older M1 day-rotation events stop owning schedules after `friends_split=true`; pre-existing persisted `friends_split=true` saves are treated as already diverged and their NPC schedules are preserved rather than rewritten;
- `m1_five_roads_focus_friend_id` chooses a deterministic visible callback for each protagonist, and `m1_five_roads_seen` prevents the introductory callback from replaying forever;
- split state, all four schedules, NPC path/result state and the visible callback survive save/reload exactly.

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

**Implementation lock:**

- the Arena uses the existing E5 checkpoint `RANK_F_TO_E`; M1_13 does not create a quest-shaped substitute or a parallel Rank flag;
- the registration action is visible only when the real competition state is Rank F, the Trial is mechanically available, the checkpoint is not already registered/completed, and the persistent roster contains at least the required two Pokémon;
- a one-Pokémon roster receives an explicit mechanical explanation but can continue free-roam indefinitely at Rank F;
- a non-F trainer or an unavailable Trial cannot register even if the player has two or more Pokémon; hidden choices cannot be forced through `choose()`;
- successful registration records `registered=true` and `registeredAtMinutes` on the E5 Trial state, but does not increment attempts, create an active match, add competition history, promote Rank, heal the party or otherwise simulate the Trial result;
- after registration the player may heal/prepare, postpone the entrance, or return to free-roam without losing the registered checkpoint;
- registration remains persistent across save/reload and is only consumed by the real M1_14 Promotion Trial lifecycle;
- dedicated M1_13 regression tests cover unavailable gate, wrong Rank, missing roster, valid registration, preparation/postponement and persistence.

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

**Implementation lock:**

- the gate is entered only from a real E5 registration for `RANK_F_TO_E`; merely reaching the Arena or viewing the registration desk never consumes an attempt;
- entering the called gate registers Nara Voss as persistent NPC `VAL_GATE_F_E_NARA_VOSS`, with Arena examiner schedule and fixed checkpoint identity;
- `begin_trial` is the only action that increments the Trial attempt counter and creates the active competition match;
- the combat handoff is a real Pokémon 5e Singles battle using exactly two player roster slots and Nara's fixed authored roster: Eevee Lv4 (`run-away`) followed by Shinx Lv4 (`intimidate`);
- Eevee, Shinx, both abilities and executable moves at Level 4 are validated against the project's offline Pokémon 5e 2024 combat pack;
- Nara's roster never scales to player Trainer level, Pokémon level, roster strength, prior results or retry count; HARD is the authored difficulty band, not a hidden stat modifier;
- the first opponent KO does not end the Trial while Nara still has her registered bench Pokémon: normal forced-switch combat rules continue the 2v2 match;
- withdrawing before combat keeps the registration active and consumes zero attempts;
- after a legal loss, retry uses the same examiner, encounter ID, fixed roster, levels, abilities and official format;
- Blue and the other Five are never substituted automatically as gate opponent;
- the authored scene never decides the winner: only the Pokémon 5e combat resolver may return `win` or `lose`, after which M1_15 owns the persistent result consequences;
- dedicated M1_14 regression tests cover combat-pack validity, persistent examiner identity, pre-start withdrawal, fixed 2v2 handoff, no scaling and retry stability.

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

**Implementation lock:**

- a Trial loss records the real E5 attempt/history result, keeps Rank F, clears active registration only as required by the retry lifecycle, and leaves `RANK_F_TO_E` available for another legal registration;
- loss never performs a narrative heal/reset: persisted HP, PP, non-volatile status and other combat state come only from the Pokémon 5e resolver and remain available to later battles/services;
- free-roam, healing and retry are all valid post-loss routes; choosing free-roam does not erase the failed attempt or pause world/NPC progression;
- a later retry uses the same M1_14 gate and a win records the second attempt honestly, sets the structured competition Rank to E and closes the checkpoint with `bestResult=win`;
- Rank E access is reachable from the result screen and from Valedarsena free-roam, but Rank E alone does not fabricate completion of remaining mandatory story beats;
- formal M1 completion / M02 unlock requires the complete exit contract: structured Rank E, `blue_met=true`, `friend_beat_01_complete=true`, and `friends_split=true`;
- if any required beat is still missing, Rank E remains valid while `m1_complete` and `m02_unlocked` stay unset; the player is routed back to live free-roam rather than receiving a fake completion;
- the canonical Rank E trigger may itself resolve `A1_FIVE_ROADS`, so Five Roads can legitimately satisfy the split requirement before the final exit screen;
- once the exit contract is satisfied, `unlock_m02` sets only `m1_complete=true` and `m02_unlocked=true`; it does not reset quests, ecology, money, roster, second-Pokémon provenance, relationships, Blue/Friend callbacks, First Official history, world pressure or NPC schedules;
- all final completion state and preserved callbacks survive save/reload exactly;
- dedicated M1_15 regression tests cover loss, retry→win, premature Rank E exit blocking, independent mandatory-beat gates, preserved callbacks, M02 unlock and final persistence.

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

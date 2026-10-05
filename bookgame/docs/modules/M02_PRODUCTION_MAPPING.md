# P5E LIBROGAME — M02 PRODUCTION MAPPING

**Module:** M02 — Sotto la Nebbia  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M02_SOTTO_LA_NEBBIA_MODULE_DESIGN.md`  
**Purpose:** production map for converting M2 into validated offline story content  
**Locked authored budget:** **5,700 stitches / 3,700 player choices**

**Module implementation status:** **MAPPED / NOT YET PRODUCTION-COMPLETE**

E1–E7 are reusable infrastructure from M1. A block may extend generic data or content, but must not fork those engines into module-specific substitutes.

---

# 1. MACRO GRAPH

```text
M2_00_RANK_E_HANDOFF
   ↓
M2_01_MISTWOOD_ENTRY
   ↓
M2_02_CAPTURE_SIGNS
   ↓
M2_03_BORGO_SALICE
   ↓
M2_04_N_ENTERS
   ↓
M2_05_RANGER_THREAD
   ↓
M2_06_MARSH_APPROACH
   ↓
M2_07_POACHING_NETWORK
   ↓
M2_08_FRIEND_BEAT_02
   ↓
M2_09_ROOKIE_INVITATIONAL
   ↓
M2_10_CRISIS_MOVES
   ↓
M2_11_NETWORK_OUTCOME
   ↓
M2_12_TRIAL_REGISTRATION
   ↓
M2_13_PROMOTION_TRIAL_E_D
   ↓
M2_14_TRIAL_RESULT
```

This is a production ordering spine, not a forced linear playthrough. Free exploration, world progression, optional content and legal postponement can reconnect between blocks.

---

# 2. BUDGET MAP

| Block | Function | Stitches | Choices | Current state |
|---|---|---:|---:|---|
| M2_00_RANK_E_HANDOFF | ereditare integralmente M1 e aprire la fascia Rank E | 286 | 186 | COMPLETE |
| M2_01_MISTWOOD_ENTRY | primo ingresso a Bosco Bruma, viaggio, nebbia e fauna contestuale | 286 | 186 | COMPLETE |
| M2_02_CAPTURE_SIGNS | indizi di cattura illegale senza rendere il crimine automaticamente evidente | 337 | 218 | COMPLETE |
| M2_03_BORGO_SALICE | hub locale, Ranger, servizi, voci e Sala Verde | 336 | 218 | COMPLETE |
| M2_04_N_ENTERS | introduzione causale di N e primo contrasto etico | 336 | 218 | COMPLETE |
| M2_05_RANGER_THREAD | collegare conseguenze Ranger/M1 alle nuove anomalie | 336 | 218 | COMPLETE |
| M2_06_MARSH_APPROACH | accesso progressivo verso Palude Mirto e aumento del rischio | 336 | 218 | COMPLETE |
| M2_07_POACHING_NETWORK | rami investigazione/intervento/evitamento con stato reale | 488 | 317 | COMPLETE |
| M2_08_FRIEND_BEAT_02 | interazione concreta con uno dei Four selezionato da schedule e stato | 488 | 317 | COMPLETE |
| M2_09_ROOKIE_INVITATIONAL | Rookie Invitational opzionale e deadline reale | 336 | 218 | COMPLETE |
| M2_10_CRISIS_MOVES | A2_CRISIS_ESCALATES e conseguenze se il player ritarda | 336 | 218 | COMPLETE |
| M2_11_NETWORK_OUTCOME | registrare esito resolved/partial/ignored/escalated senza reset | 437 | 284 | PLANNED |
| M2_12_TRIAL_REGISTRATION | eligibility E→D alla Sala Verde, roster legale e preparazione | 437 | 284 | PLANNED |
| M2_13_PROMOTION_TRIAL_E_D | checkpoint RANK_E_TO_D, Singles roster ufficiale 3 | 488 | 316 | PLANNED |
| M2_14_TRIAL_RESULT | loss/retry o Rank D; chiusura M2 senza cancellare il mondo | 437 | 284 | PLANNED |
| **TOTAL** |  | **5,700** | **3,700** | |

Budgets are authored surface capacity. One run sees only the paths made legal by its state.

---

# 3. CANONICAL EVENT BINDINGS

- `A2_LOCAL_PROBLEM`
- `A2_FRIEND_NEWS`
- `A2_ROOKIE_CUP`
- `A2_RANK_TRIAL_E_D`
- `A2_CRISIS_ESCALATES`

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

## M2_00_RANK_E_HANDOFF

**Purpose:** ereditare integralmente M1 e aprire la fascia Rank E.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**
Scene `m02-rank-e-handoff` (moduleId M02) requires all three canonical entry conditions at scene level: `m1_complete=true`, `m02_unlocked=true`, `competition.rank=E`. Any attempt to access the scene — via `present()` or `choose()` — from illegal state throws "Scene conditions are not satisfied". The idempotent activation flag `m2_active` is set by the `confirm_rank_e_active` choice (condition: `m2_active ne true`); re-entry uses `already_active` without re-firing effects. No state is modified on entry except `m2_active=true`. All M01 callbacks, roster, resources, NPC schedules, world time, quest history, and competition state are preserved verbatim. The Rank E access band (AST-MISTWOOD, AST-HILLS, AST-QUARRY, SAL-TOWN, AST-LAKE, LAC-LAKE) is confirmed via narration only — no engine mutation. N, poaching network, FRIEND_BEAT_02, Rookie Invitational, E→D Trial, and Rank D promotion are not triggered. Verified by 17 dedicated regressions (all pass) plus 260 existing M01 regressions (all pass, zero regressions).

---

## M2_01_MISTWOOD_ENTRY

**Purpose:** primo ingresso a Bosco Bruma, viaggio, nebbia e fauna contestuale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


**Implementation lock (verified 2026-10-05):**
M2_01 is entered from `m01-valedarsena-first-arrival#city_hub` only when `m02_unlocked=true`, `m2_active=true` and `competition.rank=E`. The canonical `REGION_MAP.json` edge `VAL-CITY → AST-MISTWOOD` is used verbatim at **150 minutes**; travel advances E2/Living World rather than teleporting. Scene `m02-mistwood-entry` repeats the full module-boundary gate at scene level (`m1_complete=true`, `m02_unlocked=true`, `m2_active=true`, Rank E), so illegal direct entry is rejected by both `present()` and `choose()`. Durable writes are limited to location/discovery state (`mistwood_discovered`, `mistwood_entry_complete`); roster, HP/PP/status, resources, M1 callbacks, NPC schedules and competition state are preserved. E7 is extended through `content/ecology/M02.json` using authoritative source zone `AST-MISTWOOD`; the entry observation is resolved offline through the existing ecology selector and records real encounter history. No N introduction, poaching-network quest, FRIEND_BEAT_02, Rookie Invitational or E→D Trial is started by this block.

---

## M2_02_CAPTURE_SIGNS

**Purpose:** indizi di cattura illegale senza rendere il crimine automaticamente evidente.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**
Scene `m02-capture-signs` (moduleId M02, locationId asteria_mistwood) requires all five canonical entry conditions at scene level: `m1_complete=true`, `m02_unlocked=true`, `m2_active=true`, `competition.rank=E`, `mistwood_entry_complete=true`. Any attempt to access the scene from illegal state throws "Scene conditions are not satisfied". Navigation is exposed via `m02-mistwood-entry#inner_path` through a new `explore_inner` choice (15 min travel). Durable writes are scoped to: `capture_ground_signs`, `capture_aerial_signs`, `capture_signs_noticed`, `capture_signs_investigated`, `capture_evidence_held`, `capture_site_located`, `capture_ranger_note`, `mistwood_inner_traversed`. N is not introduced, the poaching network is not identified, no quest is opened, no Ranger NPC is registered, no FRIEND_BEAT_02/Rookie Invitational/E→D Trial is started. Investigation checks (INT/Investigation DC 12/13/14) and Perception check (WIS/Perception DC 11) gate divergent information without forcing conclusions. The `correlate_with_ground` choice is hidden until `capture_ground_signs=true` is set by a prior successful ground examination. M2_01 regressions are zero (12/12 pass). Verified by 24 dedicated regressions (all pass).

---

## M2_03_BORGO_SALICE

**Purpose:** hub locale, Ranger, servizi, voci e Sala Verde.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**
Scene `m02-borgo-salice` (moduleId M02, locationId borgo_salice) requires the four M2 entry conditions at scene level: `m1_complete=true`, `m02_unlocked=true`, `m2_active=true`, `competition.rank=E`. Illegal state throws "Scene conditions are not satisfied". Navigation in: from `m02-mistwood-entry#inner_path` via `head_to_salice` (210 min); from `m02-capture-signs#inner_exit` via `continue_to_salice` (210 min). Navigation out: back to AST-MISTWOOD (210 min) or Valedarsena (360 min). Services: shop `borgo_salice_shop` (poke-ball/potion/antidote); Sala Verde visible but `RANK_E_TO_D` trial NOT registered. Ranger ElioMar: `npc_register` is idempotent; `approach_ranger_new` vs `approach_ranger_returning` branches on `npcs.ElioMar.state.role eq "ranger"`. Investigation callbacks from M2_02: `mention_forest_signs_*` hidden until `capture_signs_noticed=true`; `show_evidence_ranger` hidden until `capture_evidence_held=true`; full report path sets `capture_report_given=true`. Rumors: `connect_rumors_to_signs` hidden until `capture_signs_noticed=true`; sets `capture_rumors_connected=true`. No N introduction, no quest open, no trial registration, no roster heal. M2_01/M2_02 regressions: zero. Verified by 28 dedicated regressions (all pass).

---

## M2_04_N_ENTERS

**Purpose:** introduzione causale di N e primo contrasto etico.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**
Scene `m02-n-enters` (moduleId M02, locationId asteria_mistwood) requires all five entry conditions: `m1_complete=true`, `m02_unlocked=true`, `m2_active=true`, `competition.rank=E`, `mistwood_entry_complete=true`. Illegal state throws "Scene conditions are not satisfied". Navigation in: `m02-capture-signs#signs_entry` via `track_deeper` (condition: `capture_signs_noticed=true`, 20 min); `m02-borgo-salice#borough_hub` via `return_to_forest_n` (condition: `capture_signs_noticed` or `capture_ranger_told`, 210 min). Navigation out: back to capture signs (10 min), to Borgo Salice (210 min), to mistwood threshold (20 min). N introduction: `npc_register N` fires on `introduce_self`, `watch_n_silently`, or `move_toward_voice` choices — all idempotent; `n_met=true` is set only by these three choices. Re-entry branch: `greet_n_again` visible when `n_met=true`, `introduce_self` hidden when `n_met=true`. Ethical choices: agree path → `n_relationship_positive=true` on `accept_invitation`; question path → `n_considers` → `n_shared_concern`; ball rejected → branches to ethical nodes. Combat: `fight_zorua` triggers `M2_N_ENTERS_ZORUA_DEFENSE` (Zorua L5, wild_defense, opponentRegistered=false), returns to `n_combat_win` or `n_combat_lose`; `n_combat_win` sets `n_relationship_tension=true`. No FRIEND_BEAT_02, no poaching_network_state, no trial registration, no roster heal. M2_01/02/03 regressions: zero (12+24+28 pass). Verified by 23 dedicated regressions (all pass).

---

## M2_05_RANGER_THREAD

**Purpose:** collegare conseguenze Ranger/M1 alle nuove anomalie.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**
Scene `m02-ranger-thread` (moduleId M02, locationId borgo_salice_ranger) requires the four M2 entry conditions at scene level: `m1_complete=true`, `m02_unlocked=true`, `m2_active=true`, `competition.rank=E`. Illegal state throws "Scene conditions are not satisfied". Navigation in: from `m02-borgo-salice#ranger_signs_shared` via `pursue_investigation_signs` (5 min); from `m02-borgo-salice#ranger_evidence_received` via `pursue_investigation_evidence` (5 min). Navigation out: `thread_close#back_to_borough` returns to `m02-borgo-salice#borough_hub`. Durable writes scoped to: `ranger_thread_opened`, `local_problem_started`, `ranger_m1_m2_connected`. M1 callbacks: `mention_m1_pressure`/`mention_m1_pressure_signs` hidden until `m1_world_pressure_known=true`; when chosen, sets `ranger_m1_m2_connected=true` and routes to `elio_m1_connection`. Formal opening: all paths that call `request_formal_from_evidence`, `request_formal_from_signs`, `open_formal_from_scope`, `confirm_formal_open`, or `stay_observer` set both `ranger_thread_opened=true` and `local_problem_started=true`. Note: `local_problem_started=true` is the flag that enables `A2_CRISIS_ESCALATES` trigger via the canonical world-events engine (E6). `confirm_formal_open` also fires `npc_relationship_adjust ElioMar delta=1`. No N introduction, no poaching_network_state, no quest open, no FRIEND_BEAT_02/trial/roster mutation. M2_01–M2_04 regressions: zero (12+24+28+23 pass). Verified by 21 dedicated regressions (all pass).

---

## M2_06_MARSH_APPROACH

**Purpose:** accesso progressivo verso Palude Mirto e aumento del rischio.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**
Scene `m02-marsh-approach` (moduleId M02, locationId mir_marsh_approach) requires the four M2 entry conditions at scene level: `m1_complete=true`, `m02_unlocked=true`, `m2_active=true`, `competition.rank=E`. Illegal state throws "Scene conditions are not satisfied". Navigation in: from `m02-borgo-salice#borough_hub` via `head_to_marsh` (180 min); travel uses the canonical `REGION_MAP.json` edge SAL-TOWN→MIR-MARSH at exactly 180 minutes. Navigation out: `head_back_sal_town` (180 min → m02-borgo-salice#borough_hub); `head_back_from_done` same. The MIR-MARSH zone is added to `content/ecology/M02.json` using authoritative source zone `MIR-MARSH` with wetland/aquatic/marsh/grassland habitats. Durable writes scoped to: `marsh_approach_reached`, `marsh_boundary_observed`, `marsh_rank_gate_seen`, `marsh_boundary_anomaly_noticed`, `marsh_evidence_documented`. Rank D gate: communicated via narration at `rank_gate_info` — no Rank change, no scene-level block for the player. Ecology check: WIS/Perception DC 10 at boundary. Investigation check: INT/Investigation DC 13 for anomaly detection. `look_for_boundary_signs` and `boundary_anomaly_check` are gated by `capture_signs_noticed OR ranger_thread_opened`. No N introduction, no poaching_network_state, no quest open, no FRIEND_BEAT_02/trial. M2_01–M2_05 regressions: zero. Verified by 19 dedicated regressions (all pass).

---

## M2_07_POACHING_NETWORK

**Purpose:** rami investigazione/intervento/evitamento con stato reale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**
Scene `m02-poaching-network` (moduleId M02, locationId asteria_mistwood) requires all five entry conditions: `m1_complete=true`, `m02_unlocked=true`, `m2_active=true`, `competition.rank=E`, `mistwood_entry_complete=true`. Illegal state throws "Scene conditions are not satisfied". Navigation in: `m02-capture-signs#inner_exit` via `follow_network_trail` (condition: `capture_signs_investigated=true`, 15 min); `m02-marsh-approach#marsh_threshold_done` via `investigate_marsh_network` (condition: `marsh_boundary_anomaly_noticed=true`, 30 min). Navigation out: `network_report_ready#go_to_ranger_post` (210 min → m02-borgo-salice); `network_exit` hub (capture-signs 10 min, threshold 20 min, borgo-salice 210 min). Three main branches: **investigate** (observe_check_int INT DC 12 → evidence_strong/partial → document/intervene paths); **confront** (confront_directly → combat handoff M2_POACHING_NETWORK_01 level 4 trainer → win/lose, or blockade/demand non-combat); **avoid** (withdraw_silently → `poaching_network_state="avoided"`). Intermediate state: `poaching_network_state` is set to `"investigating"` (document/report/lose paths), `"intervened"` (blockade/win paths), or `"avoided"` (withdraw path). Note: `poaching_network_state` is an intermediate write; final outcome resolution (resolved/partial/ignored/escalated) is owned by M2_11. N interaction: `n_witness_present` choice visible only when `n_met=true AND n_relationship_positive=true`; sets `poaching_n_witness=true`. A2_LOCAL_PROBLEM event: `local_problem_started=true` was set by M2_05; this scene does not re-set it but the world-events engine uses it to track A2_CRISIS_ESCALATES eligibility. No FRIEND_BEAT_02, no trial, no Rank change. M2_01–M2_06 regressions: zero (12+24+28+23+21+19 pass). Verified by 22 dedicated regressions (all pass).

---

## M2_08_FRIEND_BEAT_02

**Purpose:** interazione concreta con uno dei Four selezionato da schedule e stato.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**
Scene `m02-friend-beat-02` (moduleId M02, locationId `borgo_salice`) requires all six entry conditions at scene level: `m1_complete=true`, `m02_unlocked=true`, `m2_active=true`, `competition.rank=E`, `friends_split=true`, `a2_friend_news_available=true`. Event binding: `A2_FRIEND_NEWS` (world event, once, trigger: `friends_split=true AND (world_day>=14 OR trainerLevel>=4)`) fires via `bookgame/content/events/M02.json` and sets both `friend_beat_02_friend_id` and `a2_friend_news_available=true` with a state-aware selector: (1) Fab if `npcs.Fab.state.fiveRoadsPath=ranger_route AND ranger_thread_opened=true`; (2) Edward if `npcs.Edward.state.fiveRoadsPath=field_training`; (3) Mattew if `npcs.Mattew.state.fiveRoadsPath=trial_preparation`; (4) Daniel (default). Navigation in: `m02-borgo-salice#borough_hub` via `receive_friend_news` (condition: `a2_friend_news_available=true AND friend_beat_02_complete ne true`). Navigation out: `friend_beat_close#back_to_borgo` → `m02-borgo-salice#borough_hub`. Four per-friend branches: **Mattew** (spar combat M2_FRIEND_MATTEW_SPAR level 3/Eevee, or conversation); **Daniel** (remote exchange, engaged or brief); **Edward** (spar combat M2_FRIEND_EDWARD_SPAR level 3/Totodile, or ecology conversation); **Fab** (intelligence share conditional on `poaching_network_state exists`, with `share_ranger_context` sub-choice if `ranger_thread_opened=true`, or general conversation). Durable writes: `friend_beat_02_complete=true` (on `back_to_borgo`), `friend_beat_02_friend_id` (set by event), `friend_beat_02_type` (combat/conversation/intelligence_share/remote_brief), `friend_beat_02_result` (win_discussed/loss_discussed/conversation_complete/etc.), optional `friend_beat_02_ecology_context` (Edward), `poaching_n_fab_connected` (Fab ranger link). Also creates `M02.json` events file with `A2_ROOKIE_CUP` (trigger: `friend_beat_02_complete=true AND (trainerLevel>=4 OR rank=E)`, sets `a2_rookie_cup_available=true`) and `A2_CRISIS_ESCALATES` (trigger: `local_problem_started AND (world_day>=20 OR local_problem_ignored)`, sets `a2_crisis_escalates_available=true` and `crisis_escalation_type`). No premature FRIEND_BEAT_02 re-trigger, no Rank change, no trial. M2_00–M2_07 regressions: zero (17+12+24+28+23+21+19+22 pass). Verified by 30 dedicated regressions (all pass). Nodes added: 25. Choices added: 45. Cumulative M02: 128 nodes / 258 choices.

---

## M2_09_ROOKIE_INVITATIONAL

**Purpose:** Rookie Invitational opzionale e deadline reale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**
Scene `m02-rookie-invitational` (moduleId M02, locationId `borgo_salice_sala_verde`) requires five entry conditions: `m1_complete=true`, `m02_unlocked=true`, `m2_active=true`, `competition.rank=E`, `a2_rookie_cup_available=true`. Event binding: `A2_ROOKIE_CUP` fires when `friend_beat_02_complete=true AND (trainerLevel>=4 OR rank=E)`, sets `a2_rookie_cup_available=true`. Navigation in: `m02-borgo-salice#sala_verde` via `check_rookie_cup` (condition: `a2_rookie_cup_available=true AND rookie_cup_complete ne true`). Navigation out: all terminal choices route to `m02-borgo-salice#borough_hub`. Full outcome set: **declined** (register_for_cup not taken → `rookie_cup_result=declined`); **forfeited** (registered but forfeit_r1 → `rookie_cup_result=forfeited`); **withdrew** (withdrew_registration or withdraw_before_r2 → `rookie_cup_result=declined`, `rookie_cup_withdrew=true`); **r1 loss** (fight_r1 loss → `rookie_cup_result=loss`); **r2 loss** (fight_r2 loss → `rookie_cup_result=loss`); **win** (fight_r2 win → `rookie_cup_result=win`). Two opponents: `M2_ROOKIE_CUP_R1` (TomasFerri, Rattata, level 4) and `M2_ROOKIE_CUP_R2` (VeraConti, Slowpoke, level 4). Optional scout: `scout_r1_opponent` sets `rookie_cup_r1_scouted=true`. No Rank E→D promotion — result is narrative/points only. Durable writes: `rookie_cup_complete=true`, `rookie_cup_result`, `rookie_cup_registered`, `rookie_cup_declined`, `rookie_cup_r1_result`, `rookie_cup_r2_result`, optionals. M2_00–M2_08 regressions: zero (17+12+24+28+23+21+19+22+30 pass). Verified by 22 dedicated regressions (all pass). Nodes added: 16. Choices added: 29. Cumulative M02: 144 nodes / 287 choices.

---

## M2_10_CRISIS_MOVES

**Purpose:** A2_CRISIS_ESCALATES e conseguenze se il player ritarda.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**
- Scene file: `content/scenes/m02-crisis-moves.json` (11 nodes / 26 choices)
- World event: `A2_CRISIS_ESCALATES` in `content/events/M02.json` (3 outcomes: network_unchecked / silent_spread / partial_response)
- Entry guard: `a2_crisis_escalates_available=true` (plus m1_complete, m02_unlocked, m2_active, rank=E)
- Hub entry via `crisis_update` choice in `m02-borgo-salice#borough_hub` (hidden after crisis_moves_complete)
- Three conditional branches from `crisis_news_arrive` gating on `crisis_escalation_type`
- Shared `crisis_assess_options` hub; ranger choices mutex on `ranger_thread_opened`
- Durable writes: `crisis_moves_complete`, `crisis_response_type`, `crisis_evidence_gathered`, `crisis_ranger_alerted`, `crisis_ranger_full_report`, `crisis_intensified`, `crisis_passive_monitor`, `local_problem_ignored`
- **Does NOT write `poaching_network_state` final values** — those are owned by M2_11
- Tests: `tests/m02-crisis-moves.test.mjs` — 22 tests, 22 pass, 0 fail
- M02 cumulative after M2_10: **155 nodes / 314 choices** (baseline 103/213; added M2_08: +25/+44, M2_09: +16/+28, M2_10: +11/+26; borgo-salice expanded: +7 choices)

---

## M2_11_NETWORK_OUTCOME

**Purpose:** registrare esito resolved/partial/ignored/escalated senza reset.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M2_12_TRIAL_REGISTRATION

**Purpose:** eligibility E→D alla Sala Verde, roster legale e preparazione.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M2_13_PROMOTION_TRIAL_E_D

**Purpose:** checkpoint RANK_E_TO_D, Singles roster ufficiale 3.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

---

## M2_14_TRIAL_RESULT

**Purpose:** loss/retry o Rank D; chiusura M2 senza cancellare il mondo.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.


# 6. STATE OWNERSHIP

Primary state families:

- `m2_complete`;
- Anchor state for N;
- `friend_beat_02_*`;
- module-specific conflict/outcome state;
- canonical competition history for events listed above;
- next-module unlock state.

Structured Pokémon/team/player state remains owned by the engine.

---

# 7. CALLBACK MATRIX

Required callback classes:

| Source | M2 behavior | Future behavior |
|---|---|---|
| prior conflict outcomes | alter context, reputation, access or information when relevant | remain persistent; never rewritten into a canonical choice |
| prior Friend Beats | influence relationship/schedule selection | rotation and callbacks continue |
| prior official results | appear in history/reputation where causal | never grant Rank by narration |
| ignored/failed quests | world may have resolved or worsened them | no frozen quest assumption |
| Anchor encounters | preserve relationship/result/schedule | eligible for later World/postgame callback |
| M2 Friend Beat | persist selected friend/type/result | later modules can reference it |

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

- `current_rank=D`;
- `n_met=true`;
- `friend_beat_02_complete=true`;
- `poaching_network_state è persistente (resolved/partial/ignored/escalated)`;
- `m03_unlocked=true`;

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

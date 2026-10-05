# P5E LIBROGAME — M03 PRODUCTION MAPPING

**Module:** M03 — Ferro, Polvere e Pressione  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M03_FERRO_POLVERE_E_PRESSIONE_MODULE_DESIGN.md`  
**Purpose:** production map for converting M3 into validated offline story content  
**Locked authored budget:** **6,000 stitches / 3,900 player choices**

**Module implementation status:** **M3_00–M3_14 COMPLETE / MODEL-ALIGNED**

E1–E7 are reusable infrastructure from M1. A block may extend generic data or content, but must not fork those engines into module-specific substitutes.

---

# 1. MACRO GRAPH

```text
M3_00_RANK_D_HANDOFF
   ↓
M3_01_CAVA_GRIGIA
   ↓
M3_02_FERRAVIA_ARRIVAL
   ↓
M3_03_OLD_MAPS
   ↓
M3_04_STEVEN_ENTERS
   ↓
M3_05_TUNNEL_WARNINGS
   ↓
M3_06_FERROX_INCIDENT
   ↓
M3_07_FERROX_RESCUE
   ↓
M3_08_FRIEND_BEAT_03
   ↓
M3_09_CROSSROADS
   ↓
M3_10_REGIONAL_CUP
   ↓
M3_11_RESCUE_OUTCOME
   ↓
M3_12_TRIAL_REGISTRATION
   ↓
M3_13_PROMOTION_TRIAL_D_C
   ↓
M3_14_TRIAL_RESULT
```

This is a production ordering spine, not a forced linear playthrough. Free exploration, world progression, optional content and legal postponement can reconnect between blocks.

---

# 2. BUDGET MAP

| Block | Function | Stitches | Choices | Current state |
|---|---|---:|---:|---|
| M3_00_RANK_D_HANDOFF | portare avanti mondo, roster, relazioni e conseguenze M2 | 290 | 189 | COMPLETE |
| M3_01_CAVA_GRIGIA | aprire paesaggio industriale, lavoro e fauna di cava | 342 | 222 | COMPLETE |
| M3_02_FERRAVIA_ARRIVAL | hub ferroviario/officina, servizi e Arena | 342 | 222 | COMPLETE |
| M3_03_OLD_MAPS | rendere leggibili segnali tecnici e mappe incomplete | 342 | 222 | COMPLETE |
| M3_04_STEVEN_ENTERS | introduzione di Steven come osservatore tecnico, non boss | 342 | 222 | COMPLETE |
| M3_05_TUNNEL_WARNINGS | accumulare segnali di rischio senza imporre una sola interpretazione | 342 | 222 | COMPLETE |
| M3_06_FERROX_INCIDENT | attivare l'incidente e i suoi timer reali | 342 | 222 | COMPLETE |
| M3_07_FERROX_RESCUE | soccorso con scelte di rischio, tempo e risorse | 496 | 323 | COMPLETE |
| M3_08_FRIEND_BEAT_03 | A3_FRIEND_CALL con uno dei Four causalmente disponibile | 496 | 323 | COMPLETE |
| M3_09_CROSSROADS | A3_CROSSROADS: priorità incompatibili e conseguenze | 342 | 222 | COMPLETE |
| M3_10_REGIONAL_CUP | competizione opzionale con bracket e risultati emergenti | 496 | 322 | COMPLETE |
| M3_11_RESCUE_OUTCOME | persistenza di vittime, danni, reputazione e responsabilità | 444 | 289 | COMPLETE |
| M3_12_TRIAL_REGISTRATION | eligibility D→C a Ferravia | 444 | 289 | COMPLETE |
| M3_13_PROMOTION_TRIAL_D_C | checkpoint RANK_D_TO_C con roster ufficiale 3 | 496 | 322 | COMPLETE |
| M3_14_TRIAL_RESULT | loss/retry o Rank C e handoff verso M4 | 444 | 289 | COMPLETE |
| **TOTAL** |  | **6,000** | **3,900** | |

Budgets are authored surface capacity. One run sees only the paths made legal by its state.

## 2A. RUNTIME LOGICAL PRODUCTION TRACKING

The legacy 6,000-stitch / 3,900-choice table above remains the authored-surface planning budget used by the module design documents. Runtime production is also tracked against the newer logical graph budget used for M1/M2-style implementation review:

- M3 logical target: approximately **260 logical nodes / 572 meaningful choices**.
- M3_00: **3 nodes / 7 choices**.
- M3_01: **21 nodes / 36 choices**.
- M3_02: **13 nodes / 31 choices**.
- M3_03: **12 nodes / 23 choices**.
- M3_04: **9 nodes / 16 choices**.
- Cycle M3_00–M3_04: **58 nodes / 113 choices**.
- M3_05: **14 nodes / 36 choices**.
- M3_06: **10 nodes / 26 choices**.
- M3_07: **22 nodes / 51 choices**.
- M3_08: **32 nodes / 71 choices**.
- M3_09: **12 nodes / 32 choices**.
- Cycle M3_05–M3_09: **90 nodes / 216 choices**.
- M3_10: **42 nodes / 99 choices**.
- M3_11: **21 nodes / 57 choices**.
- M3_12: **17 nodes / 54 choices**.
- M3_13: **7 nodes / 15 choices**.
- M3_14: **15 nodes / 40 choices**.
- Cycle M3_10–M3_14: **102 nodes / 265 choices**.
- **FINAL M3 TOTAL: 250 logical nodes / 594 meaningful choices**.
- Variance vs logical target: **−10 nodes (−3.8%) / +22 choices (+3.8%)**.

This final variance is within the intended approximate logical budget. It was not corrected with padding: every retained branch changes route, information, time, risk, relationship, competition history, consequence state or future access.

## 2B. VALIDATION EVIDENCE

Model-alignment validation was executed on GitHub Actions from branch `m3-00-04-work` after the M3_00–M3_04 repair pass:

- syntax checks: PASS;
- `npm --prefix bookgame run validate:story`: PASS;
- `npm --prefix bookgame test`: **718 pass / 0 fail / 0 skipped / 0 cancelled**;
- validation workflow run: **#278**;
- no M1/M2 regression was reported by the full suite.

The temporary CI branch trigger used for this verification was reverted immediately afterward; the canonical workflow configuration is unchanged.

M3_05–M3_09 cycle validation was then executed after implementation and repair:

- syntax checks: PASS;
- `npm --prefix bookgame run validate:story`: PASS;
- compiled graph: **36 scenes / 539 nodes / 852 stitches / 1,206 choices / 28 world events / 9 ecology zones / 343 ecology species**;
- `npm --prefix bookgame test`: **777 pass / 0 fail / 0 skipped / 0 cancelled**;
- validation workflow run: **#280**;
- the first cycle-2 validation correctly exposed 9 stale/test-fixture mismatches; those were repaired without weakening canonical A3 triggers or runtime rules, and the full rerun was green;
- no M1/M2 regression remained after the final rerun.

The temporary branch trigger was again restored to the canonical workflow after validation.

Final-cycle M3_10–M3_14 validation was executed after the budget-alignment pass:

- syntax checks: PASS;
- `npm --prefix bookgame run validate:story`: PASS;
- compiled global graph: **41 scenes / 641 nodes / 959 stitches / 1,474 choices / 28 world events / 9 ecology zones / 343 ecology species**;
- `npm --prefix bookgame test`: **811 pass / 0 fail / 0 skipped / 0 cancelled**;
- validation workflow run: **#293**;
- initial final-cycle compiler errors correctly rejected incomplete registered-opponent combat definitions; those were repaired with executable three-Pokémon opponent rosters and legal combat handoff targets;
- the final budget expansion produced one stale traversal test, which was updated to follow the newly authored between-round nodes;
- final rerun is fully green across M1, M2 and M3.

The temporary CI branch trigger was restored after the final green run; canonical workflow configuration remains unchanged.

## 2C. NODE LIBRARY / PATTERN REUSE AUDIT

The repository does not contain a standalone `NODE_LIBRARY` asset on this branch. Production reuse therefore treats the validated M1/M2 scene families and engine contracts as the concrete node-pattern library rather than inventing parallel systems.

Cycle M3_05–M3_09 reuses:

- **investigation / information ladder** from M2_02 and the existing M3_03 archive pattern → M3_05;
- **living-world escalation / crisis dispatch** from M1_07 and M2_10 → M3_06;
- **real quest deadline + off-screen consequence** from M1_06 / E3 → M3_06–M3_07;
- **stateful multi-route consequence graph** from M2_07/M2_11 → M3_07;
- **persistent friend-beat dispatch and relationship writes** from M1_09/M2_08 → M3_08;
- **contextual crossroads / diamond routing** from M1_03 plus the canonical A3 hard-anchor binding → M3_09;
- existing E1–E7 effect types only; **no new runtime effect type or duplicate subsystem was introduced**.


---

# 3. CANONICAL EVENT BINDINGS

- `A3_FRIEND_CALL`
- `A3_RANK_TRIAL_D_C`
- `A3_CROSSROADS`
- `A3_REGIONAL_CUP`

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

## M3_00_RANK_D_HANDOFF

**Purpose:** portare avanti mondo, roster, relazioni e conseguenze M2.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**

Scene `m03-handoff` requires `m2_complete=true`, `m03_unlocked=true` and structured Rank D. Activation writes only `m3_active=true`; M1/M2 roster, resources, callbacks, NPC state, world time and competition history remain intact. Re-entry is idempotent, illegal direct entry is rejected, and no Steven/Ferrox/Friend Beat/Regional Cup/D→C content is triggered.

---

## M3_01_CAVA_GRIGIA

**Purpose:** aprire paesaggio industriale, lavoro e fauna di cava.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**

Scene `m03-cava-grigia` is a real open industrial/ecology block (21 nodes / 36 choices). It reuses E7 for AST-QUARRY wildlife, E1 for Rank/module gates and check outcomes, and E2 for time. The model-alignment pass adds a state-aware production-pressure follow-up unlocked only after the player notices the production signal; a Persuasion check can reveal the tighter terrace margin without manufacturing an incident. Re-entry preserves observations and never resets prior modules.

---

## M3_02_FERRAVIA_ARRIVAL

**Purpose:** hub ferroviario/officina, servizi e Arena.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**

Scene `m03-ferravia-arrival` is the reusable Rank D hub (13 nodes / 31 choices). Ferravia's shop now reuses the same persistent money/inventory/finite-stock `purchase_item` engine as M1/M2, with a three-day refresh. The Sala Verde no longer narrates unsupported healing: rest and medical consultation advance time / write factual visit flags while leaving HP, PP and status untouched. A deferred Steven contact exposes a recoverable hub route, preventing a module-exit softlock.

---

## M3_03_OLD_MAPS

**Purpose:** rendere leggibili segnali tecnici e mappe incomplete.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**

Scene `m03-old-maps` now contains 12 nodes / 23 choices and preserves the original Investigation DC13 full/partial read. Additional state-aware archive work can cross-check Cava Grigia observations and Ferravia safety knowledge; successful reads create durable evidence flags, failed/declined reads remain non-blocking, and no future incident is auto-triggered. Re-entry is idempotent and save/reload preserves evidence.

---

## M3_04_STEVEN_ENTERS

**Purpose:** introduzione di Steven come osservatore tecnico, non boss.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**

Scene `m03-steven-enters` now contains 9 nodes / 16 choices. Steven remains a causal technical observer with persistent E4 relationship state. Refusing the first conversation records a historical deferral but is no longer terminal: Ferravia can surface `hub_recontact_steven` while `steven_met` is false, and `deferred_contact` can satisfy the mandatory exit-contract flag later. Repeated deferral preserves agency without making M3 impossible to finish.

---

## M3_05_TUNNEL_WARNINGS

**Purpose:** accumulare segnali di rischio senza imporre una sola interpretazione.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**

Scene `m03-tunnel-warnings` implements a multi-source warning ladder (14 nodes / 36 choices) using existing E1 checks and prior M3 callbacks. Notice records, worker testimony, a permitted-route Perception read, old maps, survey material and Steven context may converge without forcing one interpretation. The final synthesis records `strong`, `partial` or `low` confidence. Completing the warning block does not directly script the accident: the authored M03 Living World event starts the real Ferrox rescue quest with a 240-minute E3 deadline.

---

## M3_06_FERROX_INCIDENT

**Purpose:** attivare l'incidente e i suoi timer reali.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**

Scene `m03-ferrox-incident` contains 10 nodes / 26 choices and consumes, rather than creates, the live rescue quest. It distinguishes a still-active window from a missed one, preserves the timer while the player gathers information or returns to Ferravia, and never fabricates casualties. Steven can contribute only when he is an actually registered persistent NPC. Late arrival never reopens an expired rescue window.

---

## M3_07_FERROX_RESCUE

**Purpose:** soccorso con scelte di rischio, tempo e risorse.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**

Scene `m03-ferrox-rescue` contains 22 nodes / 51 choices. It reuses the E3 deadline contract and offers distinct route, coordination, airflow, old-map, stabilization and direct-observation approaches. Long actions can genuinely expire the rescue quest. A mandatory `rescue_checkpoint` re-reads quest status before success can be finalized, preventing deadline bypass. Persistent player contribution states are `evacuation_supported`, `stabilization_supported`, `balanced_support`, `support_only`, `declined` or `missed`; the overall casualty/damage/accountability result remains owned by M3_11.

---

## M3_08_FRIEND_BEAT_03

**Purpose:** A3_FRIEND_CALL con uno dei Four causalmente disponibile.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**

Scene `m03-friend-beat-03` contains 32 nodes / 71 choices and consumes canonical `A3_FRIEND_CALL`. The event always excludes the protagonist, prefers a physically present scheduled friend when causally legal, otherwise uses persistent Five-road context and a deterministic protagonist-specific remote fallback. Physical meetings cannot be fabricated from remote state. The block writes the required `friend_beat_03_complete`, friend ID, type and result plus E4 relationship/context changes, without changing roster, money or competition state.

---

## M3_09_CROSSROADS

**Purpose:** A3_CROSSROADS: priorità incompatibili e conseguenze.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**

Scene `m03-crossroads` contains 12 nodes / 32 choices and consumes canonical `A3_CROSSROADS`. Ferrox accountability, friend contact, D→C Trial preparation, Regional Cup and technical/exploration priorities can coexist but the player records one current priority. Regional Cup and friend routes appear only when their real event state exists. Choosing Trial or Cup never registers, resolves or promotes through narrative flags; those remain owned by E5 and their later blocks. Deferral is legal and time-bearing without falsely completing the anchor.

---

## M3_10_REGIONAL_CUP

**Purpose:** competizione opzionale con bracket e risultati emergenti.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**

Scene `m03-regional-cup` contains **42 nodes / 99 choices**. It consumes canonical `A3_REGIONAL_CUP` as an optional bracket and records every actually fought round through E5 `official_match`. Quarterfinal, semifinal and final each use a legal registered three-Pokémon opponent roster, HARD Singles metadata and independent competition-history records. Public scouting never leaks private moves/resources; between-round checks never heal or reset HP/PP/status. Decline, withdrawal and forfeit are legal results and never promote Rank.

---

## M3_11_RESCUE_OUTCOME

**Purpose:** persistenza di vittime, danni, reputazione e responsabilità.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**

Scene `m03-rescue-outcome` contains **21 nodes / 57 choices** and is the consequence layer for the Ferrox rescue. It derives human outcome, structural damage, local access, rail/economic consequences and responsibility from the persisted rescue contribution plus prior warning context. The report uses authored qualitative outcomes rather than fabricated numeric reputation points or a new runtime subsystem. Steven/worker debriefs, counterfactual limits and future inspection state are persistent where chosen. This block never rewrites the already-resolved rescue timer.

---

## M3_12_TRIAL_REGISTRATION

**Purpose:** eligibility D→C a Ferravia.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**

Scene `m03-trial-registration` contains **17 nodes / 54 choices**. Ferravia hub access applies the existing E5 `competition_trial_available` effect for `RANK_D_TO_C` with fromRank D, toRank C, requiredRosterSize 3 and retryable true. Registration is visible only when the real roster satisfies the checkpoint. Tactical preparation branches cover coverage, switch discipline, tempo, prior Cup context, post-Ferrox condition review and previous attempts without granting numeric bonuses, healing, extra Pokémon or rank advancement.

---

## M3_13_PROMOTION_TRIAL_D_C

**Purpose:** checkpoint RANK_D_TO_C con roster ufficiale 3.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**

Scene `m03-promotion-trial-d-c` contains **7 nodes / 15 choices** and is a single legal Pokémon 5e/E5 handoff. The checkpoint metadata is `RANK_D_TO_C`, Singles, official roster size 3, HARD, retryable, from D to C. The fixed registered opponent roster uses executable local combat-pack species and no invisible scaling. Pre-combat rule/field/readiness branches may change persistent preparation context but cannot decide the battle result. Only E5 win resolution promotes to Rank C.

---

## M3_14_TRIAL_RESULT

**Purpose:** loss/retry o Rank C e handoff verso M4.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior-module callbacks only when present.

**Writes:** only durable state produced by this block; no duplicate structured combat/roster data.

**Completion gate:** authored routes compile, illegal choices are hidden/rejected, world time advances where appropriate, save/reload preserves the result, and any combat/competition handoff returns through the existing Pokémon 5e/E5 lifecycle.

**Implementation lock (verified 2026-10-05):**

Scene `m03-trial-result` contains **15 nodes / 40 choices**. Loss preserves Rank D, reopens the retryable checkpoint through E5 and preserves the entire module state/history. Win reads Rank C from E5 and checks the M3 exit contract, including Steven, FRIEND_BEAT_03, persistent Ferrox state/outcome and any registered-but-unresolved Regional Cup. Successful closure writes only `m3_complete` and `m04_unlocked`; it does not author M4 content. Post-Trial nodes expose continuity for competition history, Ferrox, friends, Steven and Cup without collapsing them into a single score.


# 6. STATE OWNERSHIP

Primary state families:

- `m3_complete`;
- Anchor state for Steven Stone;
- `friend_beat_03_*`;
- module-specific conflict/outcome state;
- canonical competition history for events listed above;
- next-module unlock state.

Structured Pokémon/team/player state remains owned by the engine.

---

# 7. CALLBACK MATRIX

Required callback classes:

| Source | M3 behavior | Future behavior |
|---|---|---|
| prior conflict outcomes | alter context, reputation, access or information when relevant | remain persistent; never rewritten into a canonical choice |
| prior Friend Beats | influence relationship/schedule selection | rotation and callbacks continue |
| prior official results | appear in history/reputation where causal | never grant Rank by narration |
| ignored/failed quests | world may have resolved or worsened them | no frozen quest assumption |
| Anchor encounters | preserve relationship/result/schedule | eligible for later World/postgame callback |
| M3 Friend Beat | persist selected friend/type/result | later modules can reference it |

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

- `current_rank=C`;
- `steven_met=true`;
- `friend_beat_03_complete=true`;
- `ferrox_rescue_state persistente`;
- `regional_cup_result registrato se disputato`;
- `m04_unlocked=true`;

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

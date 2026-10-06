# P5E LIBROGAME — M12 PRODUCTION MAPPING

**Module:** M12 — Dopo il Mondo  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M12_DOPO_IL_MONDO_MODULE_DESIGN.md`  
**Locked authored budget:** **4,753 stitches / 1,884 player choices**  
**Module implementation status:** **CYCLE 2 RUNTIME-VALIDATED**

E1–E7 are shared infrastructure from M1. No module-specific replacement engine is allowed.

---

# 1. MACRO GRAPH

```text
M12_00_WORLD_EXIT_BRANCH
   ↓
M12_01_RETURN_ASTERIA
   ↓
M12_02_VALEDARSENA_CALLBACKS
   ↓
M12_03_BRUMA_CALLBACKS
   ↓
M12_04_FERROX_CALLBACKS
   ↓
M12_05_COAST_CALLBACKS
   ↓
M12_06_HIGHLANDS_CALLBACKS
   ↓
M12_07_INTERREGIONAL_CALLBACKS
   ↓
M12_08_MERIDIANA_CALLBACKS
   ↓
M12_09_FRIEND_BEAT_12
   ↓
M12_10_POSTGAME_HOOKS
   ↓
M12_11_MAIN_STORY_COMPLETE
```

The spine is production ordering, not forced linear play. Actual legal branches depend on world and competition state.

---

# 2. BUDGET MAP

| Block | Function | Stitches | Choices | Current state |
|---|---|---:|---:|---|
| M12_00_WORLD_EXIT_BRANCH | distinguere champion/eliminated/worlds_missed senza gerarchie finte | 396 | 157 | CYCLE 1 VALIDATED |
| M12_01_RETURN_ASTERIA | viaggio di ritorno e reputazione globale | 259 | 103 | CYCLE 1 VALIDATED |
| M12_02_VALEDARSENA_CALLBACKS | M1 callbacks e stato attuale della città | 442 | 175 | CYCLE 1 VALIDATED |
| M12_03_BRUMA_CALLBACKS | M2 rete di cattura, Ranger e fauna dopo il tempo trascorso | 442 | 175 | CYCLE 1 VALIDATED |
| M12_04_FERROX_CALLBACKS | M3 lavoro, rescue e infrastrutture | 442 | 175 | CYCLE 1 VALIDATED |
| M12_05_COAST_CALLBACKS | M4 porto, contrabbando e mare | 442 | 175 | CYCLE 2 VALIDATED |
| M12_06_HIGHLANDS_CALLBACKS | M5 Fulgore, Altacima e mistero antico | 442 | 175 | CYCLE 2 VALIDATED |
| M12_07_INTERREGIONAL_CALLBACKS | M6 carriera, Red, Masters e cutoff | 442 | 175 | CYCLE 2 VALIDATED |
| M12_08_MERIDIANA_CALLBACKS | M7 media, Cynthia, Qualifier e status professionale | 442 | 175 | CYCLE 2 VALIDATED |
| M12_09_FRIEND_BEAT_12 | chiusura con tutti gli amici plausibili, almeno uno garantito | 441 | 175 | PLANNED |
| M12_10_POSTGAME_HOOKS | side quest, Legendary arcs, Primo Faro, mistero antico e future stagioni | 304 | 121 | PLANNED |
| M12_11_MAIN_STORY_COMPLETE | flag finale senza chiudere free-roam o cancellare stato | 259 | 103 | PLANNED |
| **TOTAL** |  | **4,753** | **1,884** | |

---

# 3. CANONICAL EVENT BINDINGS

- `WORLD_EXIT`

Competition results must come from E5/actual bracket state. Content cannot rewrite opponent identity or result for drama.

---

# 4. ENGINE REUSE CONTRACT

- E1 Conditions for prerequisites.
- E2 Time/Calendar for schedules, recovery and event windows.
- E3 Quest State for unresolved/failed/ignored content.
- E4 NPC/Relationships for Anchor/Four state.
- E5 Competition for every official World result.
- E6 Living World for off-screen results and callbacks.
- E7 Ecology where post-event exploration exposes fauna.

---

# 5. BLOCK CONTRACTS

## M12_00_WORLD_EXIT_BRANCH

**Purpose:** distinguere champion/eliminated/worlds_missed senza gerarchie finte.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M12_01_RETURN_ASTERIA

**Purpose:** viaggio di ritorno e reputazione globale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M12_02_VALEDARSENA_CALLBACKS

**Purpose:** M1 callbacks e stato attuale della città.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M12_03_BRUMA_CALLBACKS

**Purpose:** M2 rete di cattura, Ranger e fauna dopo il tempo trascorso.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M12_04_FERROX_CALLBACKS

**Purpose:** M3 lavoro, rescue e infrastrutture.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M12_05_COAST_CALLBACKS

**Purpose:** M4 porto, contrabbando e mare.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M12_06_HIGHLANDS_CALLBACKS

**Purpose:** M5 Fulgore, Altacima e mistero antico.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M12_07_INTERREGIONAL_CALLBACKS

**Purpose:** M6 carriera, Red, Masters e cutoff.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M12_08_MERIDIANA_CALLBACKS

**Purpose:** M7 media, Cynthia, Qualifier e status professionale.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M12_09_FRIEND_BEAT_12

**Purpose:** chiusura con tutti gli amici plausibili, almeno uno garantito.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M12_10_POSTGAME_HOOKS

**Purpose:** side quest, Legendary arcs, Primo Faro, mistero antico e future stagioni.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M12_11_MAIN_STORY_COMPLETE

**Purpose:** flag finale senza chiudere free-roam o cancellare stato.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.


# 6. STATE OWNERSHIP

Primary state: `m12_complete`, cast completo callback state, `friend_beat_12_*`, module outcome state and canonical World history. HP/PP/status/inventory/roster/rank/bracket remain engine-owned.

---

# 7. REGRESSION FAMILIES

Validate:

- weakest and strongest legal entry states;
- Anchor present/absent where bracket allows;
- at least two Friend Beat eligibility patterns;
- every legal win/loss/elimination route;
- save/reload after durable results;
- no duplicate results on re-entry;
- actual opponent identity preserved;
- no narrative heal/reset;
- exit contract cannot be forced.

---

# 8. EXIT CONTRACT

- `main_story_complete=true`;
- `postgame_free_roam=true`;
- `save resta giocabile`;
- `friend_beat_12_complete=true`;

---

# 9. PRODUCTION RULE

Every counted choice must change route, information, time, risk, relationship, state, combat/encounter state or future access. Do not pad budgets.


---

# 5A. CYCLE 1 IMPLEMENTATION LOCK — M12_00–M12_04

Cycle 1 converts the WORLD_EXIT / return / first three Asteria callback blocks into runtime content while preserving the authored-surface manifest (**4,753 stitches / 1,884 choices**) and the agreed module-wide logical trajectory (**228 nodes / 502 meaningful choices**).

**Cycle 1 logical surface:** **95 nodes / 209 meaningful choices** exactly.  
**Residual M12 budget after Cycle 1:** **133 nodes / 293 meaningful choices** for M12_05→M12_11.

## M12_00_WORLD_EXIT_BRANCH

**Reuse class:** ADAPT

**Source archetypes:**
- R20 — MODULE EXIT / OUTCOME
- R21 — MODULE HANDOFF
- R33 — CROSS-MODULE CALLBACK
- R38 — COMPOSITE OUTCOME CLASSIFIER

**Unique layer:** classifies the legal entry as World Champion, World eliminated or Worlds Missed from persistent state. It never changes E5 results, opponent identity, roster or resources.

**Implementation lock:** scene `m12-world-exit-branch` contains **19 nodes / 42 meaningful choices**.

## M12_01_RETURN_ASTERIA

**Reuse class:** REUSE / ADAPT

**Source archetypes:**
- R01 — LOCATION ENTRY / RETURN
- R22 — TIME-OF-DAY / TIME-PASSAGE VARIANT
- R32 — WAIT / LET TIME PASS
- R33 — CROSS-MODULE CALLBACK

**Unique layer:** travel advances real E2 time and records only the reputation context implied by the WORLD_EXIT route. No narrative heal/reset occurs.

**Implementation lock:** scene `m12-return-asteria` contains **13 nodes / 28 meaningful choices**.

## M12_02_VALEDARSENA_CALLBACKS

**Reuse class:** ADAPT

**Source archetypes:**
- R01 — LOCATION RETURN
- R29 — LIVING WORLD OFF-SCREEN RESOLUTION
- R33 — CROSS-MODULE CALLBACK
- R38 — COMPOSITE OUTCOME CLASSIFIER

**Unique layer:** reads M1 pressure, farm and Valedarsena history, separating player-resolved, partial-player and off-screen histories without fabricating prior actions.

**Implementation lock:** scene `m12-valedarsena-callbacks` contains **21 nodes / 46 meaningful choices**.

## M12_03_BRUMA_CALLBACKS

**Reuse class:** ADAPT

**Source archetypes:**
- R29 — LIVING WORLD OFF-SCREEN RESOLUTION
- R30 — INVESTIGATION / EVIDENCE AGGREGATION
- R33 — CROSS-MODULE CALLBACK
- R38 — COMPOSITE OUTCOME CLASSIFIER

**Unique layer:** consumes the persisted M2 poaching-network outcome and Ranger history. Resolved, partial, escalated and ignored histories remain distinct.

**Implementation lock:** scene `m12-bruma-callbacks` contains **21 nodes / 46 meaningful choices**.

## M12_04_FERROX_CALLBACKS

**Reuse class:** ADAPT

**Source archetypes:**
- R29 — LIVING WORLD OFF-SCREEN RESOLUTION
- R31 — LOCAL PROBLEM RESPONSE
- R33 — CROSS-MODULE CALLBACK
- R38 — COMPOSITE OUTCOME CLASSIFIER

**Unique layer:** reads the actual M3 rescue outcome, people/damage/infrastructure state and records only a postgame callback classification. It closes Cycle 1 without setting `m12_complete` or `main_story_complete`.

**Implementation lock:** scene `m12-ferrox-callbacks` contains **21 nodes / 47 meaningful choices**.

**Library decision:** R01→R38 is sufficient for all five blocks. **No R39 candidate is required.**


---

# 10. CYCLE 1 RUNTIME VALIDATION EVIDENCE — 2026-10-06

Validated scope: **M12_00_WORLD_EXIT_BRANCH → M12_04_FERROX_CALLBACKS**.

- exact Cycle 1 runtime surface: **95 logical nodes / 209 meaningful choices**;
- full M12 trajectory remains **228 / 502**, leaving **133 / 293** for M12_05→M12_11;
- authored-surface manifest remains **4,753 stitches / 1,884 choices**;
- all **95/95** authored Cycle-1 nodes are reachable from the real M12 entry;
- no zero-incoming padding islands or broken M12-local targets remain;
- WORLD_EXIT accepts the real **World Champion**, **World eliminated** and **Worlds Missed** entry states;
- WORLD_EXIT never rewrites E5 competition state, actual results, opponent identity, roster or resources;
- Return Asteria advances real E2 calendar time and performs no narrative heal/reset;
- Valedarsena reads M1 history without fabricating player intervention;
- Bruma reads the persisted M2 poaching/Ranger outcome without changing it;
- Ferrox reads the persisted M3 rescue/infrastructure outcome without changing it;
- M12_04 sets only the Cycle-1 closure and never sets `m12_complete` or `main_story_complete`;
- save/reload preserves the prior campaign state and all Cycle-1 callback state;
- Library V2 **R01→R38** remains sufficient; **no R39 candidate is required**.

Validation:

- branch: `m12-00-04-work`;
- PR **#14**;
- validated implementation HEAD: `1b985e226e8fcf667c46de1bb5ae12b7f6eac6c7`;
- GitHub Actions **Bookgame Tests #413: SUCCESS**;
- syntax: **PASS**;
- `validate:story`: **PASS**;
- compiler: **147 scenes / 2,329 nodes / 2,684 stitches / 5,284 compiled choices**;
- tests: **1,311 passed / 0 failed / 0 skipped**.

M12 is **not module-complete yet**. The next production surface starts at M12_05.


---

# 5B. CYCLE 2 IMPLEMENTATION LOCK — M12_05–M12_08

Cycle 2 extends the runtime callback chain through the complete M4→M7 geographic/career history.

**Cycle 2 logical surface:** **84 nodes / 188 meaningful choices** exactly.  
**Cumulative M12 through M12_08:** **179 nodes / 397 meaningful choices**.  
**Residual M12 budget:** **49 nodes / 105 meaningful choices** for M12_09→M12_11.

## M12_05_COAST_CALLBACKS

**Reuse class:** ADAPT

**Source archetypes:**
- R29 — LIVING WORLD OFF-SCREEN RESOLUTION
- R30 — INVESTIGATION / EVIDENCE AGGREGATION
- R33 — CROSS-MODULE CALLBACK
- R38 — COMPOSITE OUTCOME CLASSIFIER

**Unique layer:** consumes M4 port/reef/smuggling history and keeps coordinated intercept, customs intercept, route documented, monitoring, insufficient evidence and ignored histories distinct.

**Implementation lock:** scene `m12-coast-callbacks` contains **21 nodes / 47 meaningful choices**.

## M12_06_HIGHLANDS_CALLBACKS

**Reuse class:** ADAPT

**Source archetypes:**
- R29 — LIVING WORLD OFF-SCREEN RESOLUTION
- R31 — LOCAL PROBLEM RESPONSE
- R33 — CROSS-MODULE CALLBACK
- R38 — COMPOSITE OUTCOME CLASSIFIER

**Unique layer:** separately preserves the real M5 high-altitude outcome and the player's actual ancient-mystery knowledge layer. It never promotes a partial clue into a solved mystery.

**Implementation lock:** scene `m12-highlands-callbacks` contains **21 nodes / 47 meaningful choices**.

## M12_07_INTERREGIONAL_CALLBACKS

**Reuse class:** ADAPT

**Source archetypes:**
- R28 — FRIEND / CAREER DIVERGENCE
- R29 — LIVING WORLD OFF-SCREEN RESOLUTION
- R33 — CROSS-MODULE CALLBACK
- R38 — COMPOSITE OUTCOME CLASSIFIER

**Unique layer:** Continental Cup, Masters, Red, cutoff and Primo Faro remain independent career facts. Continental and Masters results are read and preserved separately.

**Implementation lock:** scene `m12-interregional-callbacks` contains **21 nodes / 47 meaningful choices**.

## M12_08_MERIDIANA_CALLBACKS

**Reuse class:** ADAPT

**Source archetypes:**
- R23 — NPC PRESENCE / SCHEDULE GATE
- R28 — FRIEND / CAREER DIVERGENCE
- R33 — CROSS-MODULE CALLBACK
- R38 — COMPOSITE OUTCOME CLASSIFIER

**Unique layer:** sponsor/media context, Cynthia, Rank S and World qualification remain separate. Direct qualification, Last Chance qualification and Worlds Missed are preserved as distinct M7 histories.

**Implementation lock:** scene `m12-meridiana-callbacks` contains **21 nodes / 47 meaningful choices**.

**Library decision:** the four blocks are fully expressible with R01→R38. **No R39 candidate is required.**


---

# 11. CYCLE 2 RUNTIME VALIDATION EVIDENCE — 2026-10-06

Validated scope: **M12_05_COAST_CALLBACKS → M12_08_MERIDIANA_CALLBACKS**.

- exact Cycle-2 runtime surface: **84 logical nodes / 188 meaningful choices**;
- cumulative M12 through M12_08: **179 logical nodes / 397 meaningful choices**;
- exact residual for M12_09→M12_11: **49 nodes / 105 meaningful choices**;
- authored-surface manifest remains **4,753 stitches / 1,884 choices**;
- Ferrox now hands off causally into Coast without changing the M12_04 budget;
- all **84/84** Cycle-2 nodes are reachable from the Coast entry;
- no zero-incoming padding islands remain in Cycle 2;
- Coast preserves the actual M4 smuggling outcome and never promotes weak/ignored evidence;
- Highlands preserves M5 high-altitude outcome and ancient-mystery knowledge as two independent axes;
- Interregional preserves Continental Cup and Masters results independently, with Red/cutoff/Primo Faro remaining separate hooks;
- Meridiana preserves direct qualification, Last Chance qualification and Worlds Missed as distinct histories;
- sponsor/media state remains separate from competitive qualification;
- no callback rewrites prior M4→M7 outcome flags;
- save/reload preserves prior outcomes and the new M12 callback state;
- M12_08 sets only `m12_cycle2_complete=true`; it does **not** set `m12_complete` or `main_story_complete`;
- Library V2 **R01→R38** remains sufficient; **no R39 candidate is required**.

Validation:

- branch: `m12-00-04-work`;
- PR **#14**;
- validated implementation HEAD: `b86c58a3963bcf1d984c310ccc9e7698715a72a6`;
- GitHub Actions **Bookgame Tests #422: SUCCESS**;
- syntax: **PASS**;
- `validate:story`: **PASS**;
- compiler: **151 scenes / 2,413 nodes / 2,768 stitches / 5,472 compiled choices**;
- tests: **1,321 passed / 0 failed / 0 skipped**.

M12 remains open only for **M12_09 FRIEND_BEAT_12**, **M12_10 POSTGAME_HOOKS** and **M12_11 MAIN_STORY_COMPLETE**.

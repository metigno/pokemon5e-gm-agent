# P5E LIBROGAME — NODE LIBRARY V2 LOCK

**Status:** LOCKED BASELINE FOR M05→M12 AUTHORING  
**Production branch reviewed:** `m12-00-04-work`  
**Runtime-validated corpus:** M01→M12 COMPLETE
**Latest runtime evidence:** M12 COMPLETE — 228 / 502; Bookgame Tests #428: 1,333 passed / 0 failed / 0 skipped. Complete-module baseline is M01→M12.
**Catalog:** `bookgame/docs/NODE_REUSE_CATALOG.md`

---

# 1. COMPLETE MODULE BASELINE

| Module | Logical nodes | Meaningful choices |
|---|---:|---:|
| M01 | 202 | 463 |
| M02 | 189 | 409 |
| M03 | 250 | 594 |
| M04 | 253 | 639 |
| M05 | 240 | 528 |
| M06 | 220 | 484 |
| M07 | 210 | 462 |
| M08 | 190 | 418 |
| M09 | 170 | 374 |
| M10 | 160 | 352 |
| M11 | 150 | 330 |
| M12 | 228 | 502 |
| **TOTAL** | **2,462** | **5,555** |

Latest final M5 compiler validation reported:

- 71 scenes;
- 1,134 nodes;
- 1,489 stitches;
- 2,655 compiled choices;
- 44 world events;
- 14 ecology zones;
- 479 ecology species;
- 1,062 tests passed / 0 failed.

The production-review choice count and compiler choice count are different metrics; both are retained intentionally.

---

# 2. LIBRARY V2

The reusable structural vocabulary remains:

**R01→R38**

M03, M04, M05, M06 and the complete runtime implementation of M07 were audited and did not prove a missing reusable topology that justifies R39+.

This is intentional. New story content is expected to reuse or compose existing structures.

---

# 2A. M06–M07 RUNTIME EXTENSION EVIDENCE

M06 — *Oltre i Confini* is runtime-validated at **220 logical nodes / 484 meaningful choices**.

M07 — *Sotto i Riflettori* is runtime-validated at **210 logical nodes / 462 meaningful choices**.

Combined evidence:

- M6 and M7 both preserve exact logical production budgets;
- M7 contains all 14 required blocks M7_00→M7_13;
- all **210/210 M7 nodes** are reachable from the real module entry;
- no zero-incoming padding islands or broken M7-local targets remain;
- World Qualifier and Last Chance use real E5 official-match handoffs;
- Rank S remains distinct from `world_qualified`;
- the Last Chance route is finite and cannot loop until victory;
- FRIEND_BEAT_07 and Before the Lights respect real NPC schedule/location state;
- the final exit contract unlocks **M8 only for world-qualified runs** and **M12 only for Worlds Missed**;
- complete M7 Library V2 declarations use R01→R38 only; no R39 candidate is justified;
- Bookgame Tests run `37451515216` on content commit `4fc8541d10d24774b92cd78718d643c2d756da6b`: **1,158 passed / 0 failed**.

M06 and M07 therefore extend the runtime-validated Library V2 corpus through the Rank S / World Qualifier phase.


# 2B. M08 CYCLE-1 RUNTIME EXTENSION EVIDENCE

M08 — *Il Mondo nello Stesso Posto* is now **COMPLETE** at **190 logical nodes / 418 meaningful choices**.

Evidence:

- all twelve M8 blocks declare Library V2 reuse or UNIQUE composition from existing primitives;
- R01→R38 is sufficient; no R39 candidate is justified;
- all 190 authored nodes are reachable and have incoming routes;
- World arrival consumes the real M7 `world_qualified` route without resetting state;
- accreditation changes access/timeline only;
- medical control never heals or rewrites structured Pokémon state;
- World registration reads the actual roster and does not perform WORLD_DRAW;
- World Village preserves schedule-causal friend/Anchor encounters;
- final M8 runtime commit `c09fa2838d5101d9c7011527513e0bf94f1c353d`, Bookgame Tests run `37458789483` (#355): **1,200 passed / 0 failed**.

The complete-module baseline is now **M01→M08 = 1,754 runtime-validated logical nodes / 3,997 meaningful choices**.

### M08 final E5 evidence

The M8 closure adds structured World Championship state inside the existing **E5 Competition** subsystem rather than promoting a new Library node family.

Validated E5 World behavior:

- stable canonical 2060 candidate roster;
- explicit NPC qualification state respected;
- deterministic off-screen qualification only for unresolved candidates;
- exact 32-player field;
- 8 groups × 4 participants;
- deterministic per-career/per-edition draw seed;
- three persistent player opponents;
- draw idempotence;
- rendered group/opponent names from structured state;
- M9 unlock only after the M8 exit contract;
- no R39 requirement because this is engine ownership, not a new reusable narrative topology.




---

# 3. M05→M12 SPEED RULE

For every new block:

1. identify the block's engine/gameplay job;
2. map it to R01→R38 before writing scene topology;
3. REUSE the pattern when possible;
4. ADAPT parameters/state/content when necessary;
5. compose several Rxx for complex blocks;
6. keep only the story-specific layer UNIQUE;
7. create a new Rxx candidate only when R01→R38 are structurally insufficient.

The default assumption is:

**EXISTING PATTERN FIRST.**

---

# 4. REQUIRED BLOCK DECLARATION

Every M05→M12 production block must document:

```
Reuse class: REUSE | ADAPT | UNIQUE
Source archetypes:
- Rxx_NAME
Unique layer:
- ...
```

A completed M05→M12 block without a reuse declaration is incomplete from a production-process perspective.

---

# 5. NEW Rxx PROMOTION GATE

A new archetype may be promoted only if all are true:

- existing R01→R38 cannot express the topology cleanly;
- the behavior is implemented;
- automated tests pass;
- save/reload and idempotence are covered where relevant;
- it is generic rather than module-story-specific;
- plausible reuse exists outside its first scene/module.

Otherwise keep the work as an adaptation/composition of existing Rxx.

---

# 6. DO NOT REBUILD ENGINE SYSTEMS

M05→M12 must continue reusing the existing engines for:

- E1 Conditions;
- E2 Time / Calendar;
- E3 Quest State;
- E4 NPC / Relationships;
- E5 Competition;
- E6 Living World;
- E7 Ecology;
- Pokémon 5e combat/rules state.

A content gap is not permission to create a module-local substitute.

---

# 7. STRUCTURAL BUDGET

Campaign planning remains approximately:

- 2,400–2,600 logical nodes;
- ~5,000–6,000 meaningful choices.

Targets are elastic.

Do not pad modules to hit node counts.

The library-first rule should reduce authoring time, not reduce player agency or meaningful branch density.

---

# 8. AUTHORING ORDER FOR EACH MODULE

For M05→M12:

```
MODULE DESIGN
→ BLOCK JOBS
→ Rxx ROUTING
→ LOCAL STATE/CANON DATA
→ SCENE AUTHORING
→ TESTS
→ COMPILER
→ CROSS-MODULE REGRESSION
→ REUSE AUDIT
→ COMPLETE
```

This order is now canonical for production.

---

# 9. LOCK

**NODE LIBRARY V2 is the mandatory structural baseline for M05→M12.**

Current lock:

**R01→R38 / complete-module baseline M01→M12 = 2,462 runtime-validated logical nodes and 5,555 meaningful choices; no R39 requirement.**

---

## M09 CYCLE 1 VALIDATION EVIDENCE — 2026-10-06

M09 is **not module-complete yet**, so the completed Library V2 baseline remains **M01→M08**.

Validated M09 Cycle 1 extension:

- blocks: `M9_00_GROUPS_OPEN` → `M9_04_MATCHDAY_TWO`;
- runtime logical surface: **77 nodes / 170 meaningful choices** exactly;
- module trajectory preserved: **~170 nodes / ~374 meaningful choices**;
- authored-surface manifest preserved: **4,300 stitches / 2,300 choices**;
- Library V2 routing uses only **R01→R38**;
- **no R39 candidate required**;
- E5 was extended for persistent `WORLD_GROUPS` state rather than duplicated in narrative flags;
- M8 draw is immutable and supplies Matchday opponents by persistent index;
- Matchday 1 consumes opponent index 0; Matchday 2 consumes opponent index 1;
- off-screen group matches and provisional standings are derived from E5 structured results;
- Interday 1 does not heal or rebuild the roster;
- Kaia Solari uses E4/Living World schedule gating and receives no plot protection;
- all 77 Cycle-1 nodes are reachable with no zero-incoming padding;
- save/reload preserves draw, group schedule, results, standings and Kaia schedule.

Validation evidence:

- GitHub Actions **Bookgame Tests**, PR #10, run **#358**;
- syntax check: PASS;
- `validate:story`: PASS;
- full test suite: **1,216 passed / 0 failed / 0 skipped**.

Cycle 1 was later superseded by the complete M09 validation recorded below.

---

## M09 CYCLE 2 VALIDATION EVIDENCE — 2026-10-06

M09 is still **not module-complete** because M9_10 remains. The completed Library V2 baseline therefore remains **M01→M08**, while M09 is validated through M9_09.

Validated M09 Cycle 2 extension:

- blocks: `M9_05_FRIEND_BEAT_09` → `M9_09_ELIMINATED_ROUTE`;
- Cycle-2 logical surface: **79 nodes / 174 meaningful choices** exactly;
- cumulative M09 logical surface through M9_09: **156 nodes / 344 meaningful choices**;
- exact residual for M9_10: **14 nodes / 30 meaningful choices**;
- Library V2 routing still uses only **R01→R38**;
- **no R39 candidate required**;
- E4 now has a reusable World-stage Friend Beat selector driven by real qualification/group/schedule state;
- E5 resolves all eight World groups, six matches per group, and locks exactly 16 advancing participants;
- player final position and advanced/eliminated state come from structured E5 results only;
- eliminated route unlocks M12/WORLD_EXIT and never M10;
- all Cycle-2 nodes are reachable with no zero-incoming padding;
- save/reload preserves Top16, final standings, tiebreak result and eliminated handoff.

Validation evidence:

- GitHub Actions PR #10;
- syntax check: PASS;
- `validate:story`: PASS;
- full test suite: **1,230 passed / 0 failed / 0 skipped**.

Cycle 2 was later superseded by the complete M09 validation recorded below.

---

## M09 FINAL RUNTIME VALIDATION EVIDENCE — 2026-10-06

M09 — *Tre Partite per Restare* is now **COMPLETE** at **170 logical nodes / 374 meaningful choices**.

Final evidence:

- all eleven M9 blocks M9_00→M9_10 are implemented;
- exact module budget: **170 / 374**;
- all M9 authored nodes are reachable from the real module entry;
- no zero-incoming padding islands remain;
- M9_04 reconnects directly into FRIEND_BEAT_09;
- M9_08 closes through `resolution_complete` before entering either terminal route;
- advanced and eliminated routes are both reachable from the same structured E5 resolution;
- WORLD_GROUPS consumes exactly three immutable draw opponents;
- all eight groups resolve through E5 with six matches per group;
- exactly 16 participants are locked into the Top16;
- final player position and `world_group_advanced` are derived from E5, not narrative flags;
- FRIEND_BEAT_09 is driven by real World qualification/group/schedule state;
- advanced route preserves Top16 and intentionally leaves R16 pairing to M10_00;
- eliminated route unlocks M12/WORLD_EXIT and never M10;
- advanced route unlocks M10 and never M12;
- HP, PP, status, injury, roster, inventory and existing competition history persist across the module boundary;
- save/reload is covered for both World-group progression and final exit state;
- Library V2 R01→R38 remains sufficient;
- **no R39 candidate is justified**.

Final validation:

- branch: `m9-00-04-work`;
- validated content HEAD: `b9cca7a6bb0baf38c9ff65c27ad37f7180554a5e`;
- GitHub Actions Bookgame Tests run **#367**;
- syntax: PASS;
- `validate:story`: PASS;
- tests: **1,239 passed / 0 failed / 0 skipped**.

The completed Library V2 corpus is now:

**M01→M09 = 1,924 runtime-validated logical nodes / 4,371 meaningful choices.**


---

## M10 CYCLE 1 VALIDATION EVIDENCE — 2026-10-06

Historical Cycle-1 note: at this checkpoint M10 was not yet complete. This section is superseded by the final M10 validation below.

Validated M10 Cycle 1 extension:

- blocks: `M10_00_R16_BRACKET` → `M10_04_R16_AFTERMATH`;
- runtime logical surface: **78 nodes / 171 meaningful choices** exactly;
- full M10 trajectory remains **160 nodes / 352 meaningful choices**;
- exact residual for M10_05→M10_09: **82 nodes / 181 meaningful choices**;
- authored-surface manifest remains **4,000 stitches / 2,000 choices**;
- every Cycle-1 block declares Library V2 reuse/adaptation from **R01→R38**;
- **no R39 candidate is required**;
- E5 Competition now owns the persistent World knockout state rather than narrative flags;
- R16 pairings consume the immutable M09 Top16 and final group positions;
- Player vs Friend/Anchor occurs only when the actual bracket creates it;
- Silas Crowe receives no result protection and physical contact remains E4 schedule/location gated;
- official R16 combat dynamically resolves match id, opponent id and regulated roster from E5;
- the other seven R16 matches resolve deterministically from the career/draw seed;
- exactly eight unique Top8 participants and four QF pairings are locked after R16;
- player loss advances the actual opponent and preserves elimination;
- preparation and aftermath never narratively heal or rebuild structured Pokémon state;
- all **78/78 Cycle-1 nodes** are reachable with no zero-incoming padding;
- save/reload preserves bracket, Top8, roster and official history.

Validation evidence:

- branch: `m10-00-04-work`;
- PR **#11**;
- validated implementation HEAD: `e534484de220f569d0badd6e9a3089a694e2ba75`;
- GitHub Actions **Bookgame Tests #370**;
- syntax check: **PASS**;
- `validate:story`: **PASS**;
- full test suite: **1,253 passed / 0 failed / 0 skipped**.

Cycle 1 was later superseded by the complete M10 validation recorded below.


---

## M10 FINAL RUNTIME VALIDATION EVIDENCE — 2026-10-06

M10 — *Nessuna Seconda Possibilità* is now **COMPLETE** at **160 logical nodes / 352 meaningful choices**.

Final evidence:

- all ten blocks M10_00→M10_09 are implemented;
- Cycle 1 = **78 / 171**, Cycle 2 = **82 / 181**, exact total = **160 / 352**;
- all **160/160** authored M10 nodes are reachable with no zero-incoming padding;
- authored-surface manifest remains **4,000 stitches / 2,000 choices**;
- E5 owns the full R16→Top8→QF→Top4 lifecycle;
- QF victory produces two real SF pairings and a real player SF opponent for M11;
- R16/QF losses advance the actual opponent and keep the player eliminated;
- E4 Friend Beat selection is now reusable by World stage/output prefix and FRIEND_BEAT_10 reads actual knockout state;
- Player vs Friend occurs only when the bracket genuinely creates it;
- no Friend, Anchor or named rival receives result protection;
- R16 elimination reaches M12 only after FRIEND_BEAT_10;
- QF elimination cannot skip QF_AFTERMATH;
- QF victory unlocks M11 only with a locked Top4 and real SF player match;
- QF resolution is idempotent;
- save/reload preserves Top4, Friend Beat, roster and official history;
- Library V2 R01→R38 remains sufficient; **no R39 candidate is justified**.

Final validation:

- branch: `m10-00-04-work`;
- PR **#11**;
- validated implementation HEAD: `02ea569ec09839fc0bf4505b97b0ffc733cecff7`;
- GitHub Actions **Bookgame Tests #389**: **SUCCESS**;
- syntax: **PASS**;
- `validate:story`: **PASS**;
- tests: **1,269 passed / 0 failed / 0 skipped**.

The completed Library V2 corpus is now:

**M01→M10 = 2,084 runtime-validated logical nodes / 4,723 meaningful choices.**

---

## M11 CYCLE 1 VALIDATION EVIDENCE — 2026-10-06

M11 is **not module-complete yet**, so the completed Library V2 baseline remains **M01→M10**.

Validated M11 Cycle 1 extension:

- blocks: `M11_00_FINAL_FOUR_LOCK` → `M11_04_OTHER_SF`;
- runtime logical surface: **79 nodes / 175 meaningful choices** exactly;
- full M11 logical trajectory: **150 nodes / 330 meaningful choices**;
- exact residual for M11_05→M11_08: **71 nodes / 155 meaningful choices**;
- authored-surface manifest remains **3,500 stitches / 1,600 choices**;
- every Cycle-1 block declares Library V2 reuse/adaptation from **R01→R38**;
- **no R39 candidate is required**;
- E5 Competition now extends the existing World knockout lifecycle through `WORLD_SF`;
- M11 consumes the immutable Top4/SF pairings produced by M10 rather than rebuilding or reseeding them;
- the player semifinal dynamically resolves match id, opponent id and regulated roster from structured E5 state;
- win/loss comes only from Pokémon 5e combat and is recorded once in official competition history;
- the other semifinal resolves deterministically from the persistent World seed;
- exactly two actual semifinal winners become the finalists and create `WORLD_FINAL_1`;
- Rei receives no plot armor and physical contact requires actual Top4 membership plus E4 schedule/location overlap;
- SF preparation never heals, rebuilds or normalizes the persistent player roster;
- semifinal loss eliminates the player while the actual two winners still form the final;
- opening and resolving WORLD_SF are idempotent;
- all **79/79 Cycle-1 nodes** are reachable with no zero-incoming padding;
- save/reload preserves Top4, semifinal results, finalists, roster and official history.

Validation evidence:

- branch: `m11-00-04-work`;
- PR **#12**;
- validated implementation HEAD: `5ccfd61d44033e1548adf86f1a367460ca969722`;
- GitHub Actions **Bookgame Tests #393**: **SUCCESS**;
- syntax check: **PASS**;
- `validate:story`: **PASS**;
- full test suite: **1,284 passed / 0 failed / 0 skipped**.

The completed Library V2 corpus remains:

**M01→M10 = 2,084 runtime-validated logical nodes / 4,723 meaningful choices**, with M11 validated through M11_04.

---

## M11 FINAL RUNTIME VALIDATION EVIDENCE — 2026-10-06

M11 — *Per Diventare Campione* is now **COMPLETE** at **150 logical nodes / 330 meaningful choices**.

Final evidence:

- all nine blocks M11_00→M11_08 are implemented;
- Cycle 1 = **79 / 175**, Cycle 2 = **71 / 155**, exact total = **150 / 330**;
- all **150/150** authored M11 nodes are reachable with no zero-incoming padding;
- authored-surface manifest remains **3,500 stitches / 1,600 choices**;
- E5 owns the complete Top4→SF→Final→Champion lifecycle;
- WORLD_SF consumes the actual M10 Top4 and never re-seeds or replaces opponents;
- the player semifinal and final both resolve dynamic match id, opponent id and regulated roster from structured E5 state;
- the second semifinal resolves deterministically with no plot armor;
- exactly two actual SF winners create WORLD_FINAL_1;
- E4 World Friend Beat selection now supports a Final Four context and FRIEND_BEAT_11 can prioritize a true final opponent, another finalist or an eliminated friend;
- FRIEND_BEAT_11 remains mandatory on both finalist and SF-eliminated routes;
- Final Prep preserves HP, PP, statuses, injuries, inventory, money and roster without narrative reset;
- winning WORLD_FINAL_1 sets the player as actual World Champion;
- losing WORLD_FINAL_1 sets the actual opponent as World Champion and the player as runner-up;
- if the player loses in SF, E5 resolves WORLD_FINAL off-screen from the real finalists before WORLD_EXIT;
- `currentWorldChampion` / `current_world_champion` always identify the actual winner of WORLD_FINAL;
- World Final resolution is idempotent and cannot be replayed;
- Champion, runner-up and SF-eliminated routes all unlock M12/WORLD_EXIT only after FRIEND_BEAT_11 and a resolved World Final;
- save/reload preserves champion, runner-up, Friend Beat state, roster and official competition history;
- Library V2 R01→R38 remains sufficient; **no R39 candidate is justified**.

Final validation:

- branch: `m11-00-04-work`;
- PR **#12**;
- validated implementation HEAD: `730d118ad6f8e72e9941dbe6512de1466670d66d`;
- GitHub Actions **Bookgame Tests #409**: **SUCCESS**;
- syntax: **PASS**;
- `validate:story`: **PASS**;
- tests: **1,298 passed / 0 failed / 0 skipped**.

The completed Library V2 corpus is now:

**M01→M11 = 2,234 runtime-validated logical nodes / 5,053 meaningful choices.**



---

## M12 CYCLE 1 RUNTIME EXTENSION EVIDENCE — 2026-10-06

M12 — *Dopo il Mondo* is **not module-complete yet**, so the completed Library V2 baseline remains **M01→M11 = 2,234 logical nodes / 5,053 meaningful choices**.

Validated M12 Cycle 1 extension:

- blocks: `M12_00_WORLD_EXIT_BRANCH` → `M12_04_FERROX_CALLBACKS`;
- runtime logical surface: **95 nodes / 209 meaningful choices** exactly;
- full M12 trajectory: **228 nodes / 502 meaningful choices**;
- exact residual for M12_05→M12_11: **133 nodes / 293 meaningful choices**;
- authored-surface manifest remains **4,753 stitches / 1,884 choices**;
- all five blocks declare Library V2 reuse/adaptation from **R01→R38**;
- **no R39 candidate is required**;
- WORLD_EXIT consumes three legal persisted entry classes: World Champion, World eliminated and Worlds Missed;
- M12 never rewrites E5 World results, champion identity, opponents or official competition history;
- M12_01 uses real E2 time passage and does not heal, rebuild or normalize the Pokémon roster;
- M12_02 reads M1 Valedarsena/world-pressure history and preserves the original flags;
- M12_03 reads the real M2 poaching-network/Ranger outcome and preserves the original outcome;
- M12_04 reads the real M3 Ferrox rescue/infrastructure outcome and preserves the original outcome;
- all **95/95 Cycle-1 nodes** are reachable with no zero-incoming padding;
- save/reload preserves competition, roster and callback flags;
- Cycle 1 closes with `m12_cycle1_complete=true` only; it does **not** set `m12_complete` or `main_story_complete`.

Validation evidence:

- branch: `m12-00-04-work`;
- PR **#14**;
- validated implementation HEAD: `1b985e226e8fcf667c46de1bb5ae12b7f6eac6c7`;
- GitHub Actions **Bookgame Tests #413: SUCCESS**;
- syntax: **PASS**;
- `validate:story`: **PASS**;
- compiler: **147 scenes / 2,329 nodes / 2,684 stitches / 5,284 compiled choices**;
- full test suite: **1,311 passed / 0 failed / 0 skipped**.

The current Library decision therefore remains:

**R01→R38 / complete-module baseline M01→M11, with M12 runtime-validated through M12_04; no R39 requirement.**


---

## M12 CYCLE 2 RUNTIME EXTENSION EVIDENCE — 2026-10-06

M12 — *Dopo il Mondo* remains **not module-complete**. The complete-module Library V2 baseline remains **M01→M11 = 2,234 logical nodes / 5,053 meaningful choices**.

Validated extension through M12_08:

- Cycle 2 blocks: `M12_05_COAST_CALLBACKS` → `M12_08_MERIDIANA_CALLBACKS`;
- Cycle-2 surface: **84 nodes / 188 meaningful choices**;
- cumulative M12 surface: **179 nodes / 397 meaningful choices**;
- residual M12_09→M12_11: **49 nodes / 105 meaningful choices**;
- all Cycle-2 blocks compose **R01→R38**; **no R39 candidate required**;
- M4 coast/smuggling history is read, never rewritten;
- M5 altitude result and ancient-mystery knowledge remain independent persisted axes;
- M6 Continental/Masters results remain independent persisted axes;
- M7 direct qualification, Last Chance qualification and Worlds Missed remain distinct persisted routes;
- sponsor/media state is not conflated with qualification state;
- all **84/84 Cycle-2 nodes** are forward-reachable with no zero-incoming padding;
- save/reload preserves original M4→M7 outcomes and M12 callback state;
- no narrative heal, roster reset, rank rewrite or competition rewrite is introduced.

Validation evidence:

- branch: `m12-00-04-work`;
- PR **#14**;
- validated implementation HEAD: `b86c58a3963bcf1d984c310ccc9e7698715a72a6`;
- GitHub Actions **Bookgame Tests #422: SUCCESS**;
- syntax: **PASS**;
- `validate:story`: **PASS**;
- compiler: **151 scenes / 2,413 nodes / 2,768 stitches / 5,472 compiled choices**;
- full suite: **1,321 passed / 0 failed / 0 skipped**.

Current Library decision:

**R01→R38 / complete-module baseline M01→M11, with M12 runtime-validated through M12_08; no R39 requirement.**


---

## M12 FINAL RUNTIME VALIDATION EVIDENCE — 2026-10-06

M12 — *Dopo il Mondo* is **COMPLETE** at **228 logical nodes / 502 meaningful choices**.

Final evidence:

- all twelve M12 blocks M12_00→M12_11 are implemented;
- exact cycle totals: **95/209 + 84/188 + 49/105 = 228/502**;
- all **228/228** authored M12 nodes are reachable from WORLD_EXIT;
- no zero-incoming padding remains;
- Champion, eliminated and Worlds Missed histories all reach the same structural postgame without erasing their differences;
- all M1→M7 callback outcomes are read from persistent state and never rewritten;
- FRIEND_BEAT_12 composes R23/R26/R27/R28/R33 and needs no new reusable topology;
- postgame hooks reuse E1→E7 and the same save model;
- `MAIN_STORY_COMPLETE` leaves free roam writable and interactive;
- save/reload preserves complete campaign state;
- Library V2 **R01→R38** is sufficient through the full campaign;
- **no R39 candidate is justified**.

Final validation:

- branch: `m12-00-04-work`;
- PR **#14**;
- validated runtime HEAD: `4323e799fc3344e56e9cb6d72c40aa94ab90249a`;
- GitHub Actions **Bookgame Tests #428: SUCCESS**;
- compiler: **154 scenes / 2,462 nodes / 2,817 stitches / 5,577 compiled choices / 60 world events / 14 ecology zones / 479 ecology species**;
- full suite: **1,333 passed / 0 failed / 0 skipped**.

The complete Library V2 corpus is now:

**M01→M12 = 2,462 runtime-validated logical nodes / 5,555 meaningful choices.**

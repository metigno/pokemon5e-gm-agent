# P5E LIBROGAME — M11 PRODUCTION MAPPING

**Module:** M11 — Per Diventare Campione  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M11_PER_DIVENTARE_CAMPIONE_MODULE_DESIGN.md`  
**Locked authored budget:** **3,500 stitches / 1,600 player choices**  
**Module implementation status:** **CYCLE 1 RUNTIME-VALIDATED**

E1–E7 are shared infrastructure from M1. No module-specific replacement engine is allowed.

---

# 1. MACRO GRAPH

```text
M11_00_FINAL_FOUR_LOCK
   ↓
M11_01_REI_THREAD
   ↓
M11_02_SF_PREP
   ↓
M11_03_WORLD_SF
   ↓
M11_04_OTHER_SF
   ↓
M11_05_FRIEND_BEAT_11
   ↓
M11_06_FINAL_PREP
   ↓
M11_07_WORLD_FINAL
   ↓
M11_08_CHAMPIONSHIP_OUTCOME
```

The spine is production ordering, not forced linear play. Actual legal branches depend on world and competition state.

---

# 2. BUDGET MAP

| Block | Function | Stitches | Choices | Current state |
|---|---|---:|---:|---|
| M11_00_FINAL_FOUR_LOCK | lock dei quattro semifinalisti reali e del bracket | 305 | 140 | CYCLE 1 VALIDATED |
| M11_01_REI_THREAD | Rei come competitor reale, mai finalista garantito | 359 | 164 | CYCLE 1 VALIDATED |
| M11_02_SF_PREP | preparazione con stato squadra persistente | 305 | 140 | CYCLE 1 VALIDATED |
| M11_03_WORLD_SF | semifinale reale, single elimination | 521 | 238 | CYCLE 1 VALIDATED |
| M11_04_OTHER_SF | risoluzione dell'altra semifinale senza plot armor | 359 | 164 | CYCLE 1 VALIDATED |
| M11_05_FRIEND_BEAT_11 | amico nel Final Four o ultimo contatto plausibile | 521 | 238 | PLANNED |
| M11_06_FINAL_PREP | preparazione finale senza reset gratuito | 305 | 139 | PLANNED |
| M11_07_WORLD_FINAL | finale reale: Champion is whoever actually wins | 520 | 238 | PLANNED |
| M11_08_CHAMPIONSHIP_OUTCOME | registrare campione/finalista/eliminato e aprire WORLD_EXIT | 305 | 139 | PLANNED |
| **TOTAL** |  | **3,500** | **1,600** | |

---

# 3. CANONICAL EVENT BINDINGS

- `WORLD_SF`
- `WORLD_FINAL`

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

## M11_00_FINAL_FOUR_LOCK

**Purpose:** lock dei quattro semifinalisti reali e del bracket.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M11_01_REI_THREAD

**Purpose:** Rei come competitor reale, mai finalista garantito.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M11_02_SF_PREP

**Purpose:** preparazione con stato squadra persistente.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M11_03_WORLD_SF

**Purpose:** semifinale reale, single elimination.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M11_04_OTHER_SF

**Purpose:** risoluzione dell'altra semifinale senza plot armor.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M11_05_FRIEND_BEAT_11

**Purpose:** amico nel Final Four o ultimo contatto plausibile.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M11_06_FINAL_PREP

**Purpose:** preparazione finale senza reset gratuito.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M11_07_WORLD_FINAL

**Purpose:** finale reale: Champion is whoever actually wins.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.

---

## M11_08_CHAMPIONSHIP_OUTCOME

**Purpose:** registrare campione/finalista/eliminato e aprire WORLD_EXIT.

**Reads:** canonical player/world/NPC/competition state required by the scene; prior callbacks only when present.

**Writes:** only durable state produced here; never duplicate structured combat, roster, rank or bracket data.

**Completion gate:** compiled legal routes, canonical event handoff where applicable, save/reload persistence, idempotence, and no forced hidden choice.



# 5A. CYCLE 1 IMPLEMENTATION LOCK — M11_00–M11_04

Cycle 1 converts the Final Four / semifinal half of M11 into runtime content while preserving the locked authored-surface manifest (**3,500 stitches / 1,600 choices**) and the module-wide logical trajectory (**150 nodes / 330 meaningful choices**).

**Cycle 1 logical surface:** **79 nodes / 175 meaningful choices** exactly.  
**Residual M11 budget after Cycle 1:** **71 nodes / 155 meaningful choices** for M11_05→M11_08.

## M11_00_FINAL_FOUR_LOCK

**Reuse class:** ADAPT / E5 EXTENSION

**Source archetypes:**
- R37 — MULTI-ROUND TOURNAMENT LIFECYCLE
- R33 — CROSS-MODULE CALLBACK
- R21 — MODULE HANDOFF
- R38 — COMPOSITE OUTCOME CLASSIFIER

**Unique layer:** consumes the immutable Top4 and semifinal pairings produced by M10. E5 opens WORLD_SF idempotently without re-seeding, replacing opponents or granting plot armor.

**Implementation lock:** scene `m11-final-four-lock` contains **13 nodes / 29 meaningful choices**.

## M11_01_REI_THREAD

**Reuse class:** ADAPT

**Source archetypes:**
- R23 — NPC PRESENCE / SCHEDULE GATE
- R24 — PERSISTENT NPC FIRST MEETING
- R25 — MULTI-CONTEXT ANCHOR INTRO
- R33 — CROSS-MODULE CALLBACK

**Unique layer:** Rei is read from the actual Top4 state. Physical contact requires real venue overlap; presence in the story never guarantees presence in the semifinal or final.

**Implementation lock:** scene `m11-rei-thread` contains **15 nodes / 34 meaningful choices**.

## M11_02_SF_PREP

**Reuse class:** REUSE / ADAPT

**Source archetypes:**
- R16 — ROSTER PREPARATION / ELIGIBILITY INFO
- R13 — MEDICAL / POKÉMON CENTER SERVICE
- R22 — TIME-OF-DAY VARIANT
- R32 — WAIT / LET TIME PASS

**Unique layer:** preparation preserves the post-QF team exactly; time can advance but no scene effect heals, rebuilds or normalizes the roster.

**Implementation lock:** scene `m11-sf-prep` contains **13 nodes / 29 meaningful choices**.

## M11_03_WORLD_SF

**Reuse class:** ADAPT / E5 EXTENSION

**Source archetypes:**
- R06 — COMBAT HANDOFF
- R15 — FIRST/OFFICIAL MATCH LIFECYCLE
- R37 — MULTI-ROUND TOURNAMENT LIFECYCLE

**Unique layer:** WORLD_SF uses the real E5 player semifinal match, opponent and persistent regulated roster. Win/loss comes only from Pokémon 5e combat.

**Implementation lock:** scene `m11-world-sf` contains **22 nodes / 49 meaningful choices**.

## M11_04_OTHER_SF

**Reuse class:** ADAPT

**Source archetypes:**
- R29 — LIVING WORLD OFF-SCREEN RESOLUTION
- R37 — MULTI-ROUND TOURNAMENT LIFECYCLE
- R38 — COMPOSITE OUTCOME CLASSIFIER

**Unique layer:** the second semifinal resolves deterministically from persistent World state; the two actual winners become the only finalists and produce WORLD_FINAL_1. Rei/friends/rivals receive no result protection.

**Implementation lock:** scene `m11-other-sf` contains **16 nodes / 34 meaningful choices**.

**Library decision:** R01→R38 fully expresses Cycle 1. **No R39 candidate is required.**

**Runtime validation evidence:**
- branch: `m11-00-04-work`;
- PR: **#12**;
- validated implementation HEAD: `5ccfd61d44033e1548adf86f1a367460ca969722`;
- GitHub Actions **Bookgame Tests #393**: **SUCCESS**;
- syntax check: **PASS**;
- `validate:story`: **PASS**;
- full suite: **1,284 passed / 0 failed / 0 skipped**;
- Cycle-1 reachability: **79/79 nodes reachable**, zero zero-incoming padding.



# 6. STATE OWNERSHIP

Primary state: `m11_complete`, Rei callback state, `friend_beat_11_*`, module outcome state and canonical World history. HP/PP/status/inventory/roster/rank/bracket remain engine-owned.

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

- `world_finalist/world_champion coerenti con risultati reali`;
- `current_world_champion=actual winner`;
- `friend_beat_11_complete=true`;
- `WORLD_EXIT disponibile`;
- `m12_unlocked=true`;

---

# 9. PRODUCTION RULE

Every counted choice must change route, information, time, risk, relationship, state, combat/encounter state or future access. Do not pad budgets.

# P5E LIBROGAME — M12 PRODUCTION MAPPING

**Module:** M12 — Dopo il Mondo  
**Authority:** subordinate to `P5E_LIBROGAME_ENGINE_SOURCE_OF_TRUTH.md`, `P5E_LIBROGAME_12_MODULES_MASTER.md` and `M12_DOPO_IL_MONDO_MODULE_DESIGN.md`  
**Locked authored budget:** **4,753 stitches / 1,884 player choices**  
**Module implementation status:** **MAPPED / NOT YET PRODUCTION-COMPLETE**

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
| M12_00_WORLD_EXIT_BRANCH | distinguere champion/eliminated/worlds_missed senza gerarchie finte | 396 | 157 | PLANNED |
| M12_01_RETURN_ASTERIA | viaggio di ritorno e reputazione globale | 259 | 103 | PLANNED |
| M12_02_VALEDARSENA_CALLBACKS | M1 callbacks e stato attuale della città | 442 | 175 | PLANNED |
| M12_03_BRUMA_CALLBACKS | M2 rete di cattura, Ranger e fauna dopo il tempo trascorso | 442 | 175 | PLANNED |
| M12_04_FERROX_CALLBACKS | M3 lavoro, rescue e infrastrutture | 442 | 175 | PLANNED |
| M12_05_COAST_CALLBACKS | M4 porto, contrabbando e mare | 442 | 175 | PLANNED |
| M12_06_HIGHLANDS_CALLBACKS | M5 Fulgore, Altacima e mistero antico | 442 | 175 | PLANNED |
| M12_07_INTERREGIONAL_CALLBACKS | M6 carriera, Red, Masters e cutoff | 442 | 175 | PLANNED |
| M12_08_MERIDIANA_CALLBACKS | M7 media, Cynthia, Qualifier e status professionale | 442 | 175 | PLANNED |
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
